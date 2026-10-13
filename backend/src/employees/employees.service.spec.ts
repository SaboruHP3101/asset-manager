import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import * as schema from '../db/schema.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';

describe('EmployeesService', () => {
  let service: EmployeesService;
  const from = vi.fn();
  const select = vi.fn(() => ({ from }));
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const employee = {
    employeeCode: 'EMP-03',
    fullName: 'New Employee',
    email: 'new@example.com',
    departmentId: 'department-id',
    roleId: 'role-id',
    isDepartmentHead: false,
  };

  beforeEach(async () => {
    from.mockReset();
    select.mockClear();
    returning.mockReset();
    values.mockClear();
    set.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: DRIZZLE, useValue: { select, insert, update } },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('selects only the public table fields and preserves the database result order', async () => {
    const rows = [{ employeeCode: 'EMP-02' }, { employeeCode: 'EMP-01' }];

    from.mockResolvedValue(rows);

    await expect(service.findAll()).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith(schema.employees);
    expect(select).toHaveBeenCalledWith({
      id: schema.employees.id,
      employeeCode: schema.employees.employeeCode,
      fullName: schema.employees.fullName,
      email: schema.employees.email,
      phoneNumber: schema.employees.phoneNumber,
      departmentId: schema.employees.departmentId,
      roleId: schema.employees.roleId,
      isDepartmentHead: schema.employees.isDepartmentHead,
      isActive: schema.employees.isActive,
    });
  });

  it('returns an empty list when there are no employees', async () => {
    from.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('propagates database failures', async () => {
    from.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.findAll()).rejects.toThrow('Database unavailable');
  });

  it('creates employees with an explicit safe returning projection', async () => {
    returning.mockResolvedValue([employee]);

    await expect(service.create(employee)).resolves.toEqual(employee);
    expect(values).toHaveBeenCalledWith(employee);
    expect(returning).toHaveBeenCalledWith(
      expect.objectContaining({
        id: schema.employees.id,
        departmentId: schema.employees.departmentId,
        roleId: schema.employees.roleId,
      }),
    );
    expect(returning.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('changes activation without overwriting other employee fields', async () => {
    returning.mockResolvedValue([{ ...employee, isActive: false }]);

    await expect(
      service.update('employee-id', { isActive: false }),
    ).resolves.toMatchObject({ isActive: false });
    expect(set).toHaveBeenCalledWith({
      isActive: false,
      updatedAt: expect.any(Date),
    });
    expect(returning.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('reports conflicts on create and update', async () => {
    returning.mockRejectedValue(
      new DrizzleQueryError('query', [], new Error('duplicate')),
    );

    await expect(service.create(employee)).rejects.toThrow(ConflictException);
    await expect(service.update('employee-id', employee)).rejects.toThrow(
      ConflictException,
    );
  });

  it('reports updates to missing employees', async () => {
    returning.mockResolvedValue([]);

    await expect(
      service.update('missing-id', { isActive: false }),
    ).rejects.toThrow(NotFoundException);
  });
});
