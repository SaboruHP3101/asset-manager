import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { EmployeesService } from '../employees/employees.service.js';
import { AuthService } from './auth.service.js';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';
import * as schema from '../db/schema.js';

describe('AuthService.getEmployeeId', () => {
  const jwt = new JwtService({ secret: 'auth-service-test' });
  const databaseFailure = new Error('database offline');
  let service: AuthService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: EmployeesService, useValue: {} },
        {
          provide: DRIZZLE,
          useValue: {
            select: () => {
              throw databaseFailure;
            },
            update: () => {
              throw databaseFailure;
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns the employee ID from an access token', async () => {
    const token = await jwt.signAsync({ sub: 'employee-id' });

    await expect(service.getEmployeeId(`Bearer ${token}`)).resolves.toBe(
      'employee-id',
    );
  });

  it('does not disguise a profile database failure as an invalid token', async () => {
    const token = await jwt.signAsync({ sub: 'employee-id' });

    await expect(service.getProfile(`Bearer ${token}`)).rejects.toBe(
      databaseFailure,
    );
  });

  it('does not disguise an activation database failure as an expired token', async () => {
    const token = await jwt.signAsync({
      sub: 'employee-id',
      purpose: 'activation',
    });

    await expect(
      service.setupFirstTimePassword(token, { password: 'test-password' }),
    ).rejects.toBe(databaseFailure);
  });

  it.each([
    ['an activation token', { sub: 'employee-id', purpose: 'activation' }],
    ['a missing subject', {}],
    ['an empty subject', { sub: '' }],
    ['a non-string subject', { sub: 1 }],
  ])('rejects %s even when the signature is valid', async (_, payload) => {
    const token = await jwt.signAsync(payload);

    await expect(service.getEmployeeId(`Bearer ${token}`)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('authentication without roles', () => {
  const jwt = new JwtService({ secret: 'role-removal-test' });
  const employee = {
    id: 'employee-id',
    email: 'it@example.test',
    departmentId: 'department-id',
    departmentName: 'IT',
    isDepartmentHead: false,
    isActive: true,
  };
  const findOneByEmail = vi.fn();
  const where = vi.fn();
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));
  let service: AuthService;
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();
    where.mockResolvedValue([employee]);
    findOneByEmail.mockResolvedValue({
      ...employee,
      password: await bcrypt.hash('test-password', 4),
    });
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtAuthGuard,
        { provide: JwtService, useValue: jwt },
        { provide: EmployeesService, useValue: { findOneByEmail } },
        { provide: DRIZZLE, useValue: { select } },
      ],
    }).compile();

    service = module.get(AuthService);
    guard = module.get(JwtAuthGuard);
  });

  it('issues an access token without a role claim', async () => {
    const result = await service.login({
      email: employee.email,
      password: 'test-password',
    });
    const payload = await jwt.verifyAsync(result.accessToken!);

    expect(payload).toMatchObject({ sub: employee.id, email: employee.email });
    expect(payload).not.toHaveProperty('role');
  });

  it('still rejects a wrong password and an inactive account', async () => {
    await expect(
      service.login({ email: employee.email, password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
    findOneByEmail.mockResolvedValue({
      ...employee,
      isActive: false,
      password: await bcrypt.hash('test-password', 4),
    });
    await expect(
      service.login({ email: employee.email, password: 'test-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns department permissions and no role in the profile', async () => {
    where.mockResolvedValue([
      {
        email: employee.email,
        department: 'IT',
        isDepartmentHead: false,
      },
    ]);
    const token = await jwt.signAsync({ sub: employee.id });
    const profile = await service.getProfile(`Bearer ${token}`);

    expect(profile.allowedActions).toContain('repair.assess');
    expect(profile.allowedActions).not.toContain('repair.approve_it');
    expect(profile).not.toHaveProperty('role');
    expect(innerJoin).toHaveBeenCalledTimes(1);
    expect(innerJoin).toHaveBeenCalledWith(
      schema.departments,
      expect.anything(),
    );
  });

  it.each([undefined, 'legacy-role-id'])(
    'accepts access tokens with role claim %s',
    async (role) => {
      const token = await jwt.signAsync({
        sub: employee.id,
        ...(role ? { role } : {}),
      });
      const request: {
        headers: { authorization: string };
        user?: AuthenticatedEmployee;
      } = {
        headers: { authorization: `Bearer ${token}` },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual(employee);
      expect(innerJoin).toHaveBeenCalledTimes(1);
      expect(innerJoin).toHaveBeenCalledWith(
        schema.departments,
        expect.anything(),
      );
    },
  );

  it.each([{ rows: [] }, { rows: [{ ...employee, isActive: false }] }])(
    'rejects missing or inactive employees in the guard',
    async ({ rows }) => {
      where.mockResolvedValue(rows);
      const token = await jwt.signAsync({ sub: employee.id });
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    },
  );
});
