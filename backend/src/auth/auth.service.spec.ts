import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { EmployeesService } from '../employees/employees.service.js';
import { AuthService } from './auth.service.js';

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
