import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  const findAll = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const values: CreateEmployeeDto = {
    employeeCode: 'EMP-03',
    fullName: 'New Employee',
    email: 'new@example.com',
    departmentId: '11111111-1111-4111-8111-111111111111',
    roleId: '22222222-2222-4222-8222-222222222222',
    isDepartmentHead: false,
  };
  const actor: AuthenticatedEmployee = {
    id: 'employee-id',
    email: 'it@example.com',
    roleId: 'role-id',
    roleName: 'IT',
    departmentId: 'department-id',
    departmentName: 'IT',
    isDepartmentHead: false,
  };

  beforeEach(async () => {
    findAll.mockReset();
    create.mockReset();
    update.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: EmployeesService, useValue: { findAll, create, update } },
      ],
    }).compile();

    controller = new EmployeesController(module.get(EmployeesService));
  });

  it('requires the JWT guard on the list endpoint', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      EmployeesController.prototype.findAll,
    );

    expect(guards).toContain(JwtAuthGuard);
  });

  it('requires JWT authentication on creation and updates', () => {
    for (const method of ['create', 'update'] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          EmployeesController.prototype[method],
        ),
      ).toContain(JwtAuthGuard);
    }
  });

  it('allows IT staff and heads to create, edit, and change activation', async () => {
    create.mockResolvedValue(values);
    update.mockResolvedValue({ ...values, isActive: false });

    for (const isDepartmentHead of [false, true]) {
      const employee = { ...actor, isDepartmentHead };

      await expect(controller.create(values, employee)).resolves.toEqual(
        values,
      );
      await expect(
        controller.update('employee-id', values, employee),
      ).resolves.toEqual({ ...values, isActive: false });
      await expect(
        controller.update('employee-id', { isActive: false }, employee),
      ).resolves.toEqual({ ...values, isActive: false });
    }
  });

  it('rejects non-IT creation and updates before calling the service', () => {
    const employee = { ...actor, departmentName: 'PROCUREMENT' };

    expect(() => controller.create(values, employee)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      controller.update('employee-id', { isActive: false }, employee),
    ).toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects password fields and accepts activation-only updates', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { ...values, password: 'forbidden' },
        { type: 'body', metatype: CreateEmployeeDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { password: 'forbidden' },
        { type: 'body', metatype: UpdateEmployeeDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { isActive: false },
        { type: 'body', metatype: UpdateEmployeeDto },
      ),
    ).resolves.toMatchObject({ isActive: false });
  });

  it('returns employee data to IT staff and the IT head', async () => {
    const rows = [{ employeeCode: 'EMP-02' }, { employeeCode: 'EMP-01' }];

    findAll.mockResolvedValue(rows);

    await expect(controller.findAll(actor)).resolves.toEqual(rows);
    await expect(
      controller.findAll({ ...actor, isDepartmentHead: true }),
    ).resolves.toEqual(rows);
  });

  it('rejects employees outside IT without querying employee data', () => {
    expect(() =>
      controller.findAll({ ...actor, departmentName: 'PROCUREMENT' }),
    ).toThrow(ForbiddenException);
    expect(findAll).not.toHaveBeenCalled();
  });
});
