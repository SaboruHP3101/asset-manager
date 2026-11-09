import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { EmployeesService } from '../employees/employees.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService.getEmployeeId', () => {
  const jwt = new JwtService({ secret: 'auth-service-test' });
  let service: AuthService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: EmployeesService, useValue: {} },
        { provide: DRIZZLE, useValue: {} },
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
