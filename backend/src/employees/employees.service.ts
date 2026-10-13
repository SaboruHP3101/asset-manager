import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import { Employee } from './entities/employee.entity.js';
import { DrizzleQueryError, eq } from 'drizzle-orm';

const employeeFields = {
  id: schema.employees.id,
  employeeCode: schema.employees.employeeCode,
  fullName: schema.employees.fullName,
  email: schema.employees.email,
  phoneNumber: schema.employees.phoneNumber,
  departmentId: schema.employees.departmentId,
  roleId: schema.employees.roleId,
  isDepartmentHead: schema.employees.isDepartmentHead,
  isActive: schema.employees.isActive,
};

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      const [newEmployee] = await this.db
        .insert(schema.employees)
        .values(createEmployeeDto)
        .returning(employeeFields);

      return newEmployee;
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Mã nhân viên hoặc email đã tồn tại, hoặc phòng ban/vai trò không hợp lệ.',
        );
      }

      throw new InternalServerErrorException();
    }
  }

  async findAll() {
    return this.db.select(employeeFields).from(schema.employees);
  }

  async findOne(id: string) {
    const employee = await this.db.query.employees.findFirst({
      where: eq(schema.employees.id, id),
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return new Employee(employee);
  }

  async findOneByEmail(email: string) {
    const employee = await this.db.query.employees.findFirst({
      where: eq(schema.employees.email, email),
    });

    if (!employee) {
      throw new NotFoundException(`Employee with email ${email} not found`);
    }

    return new Employee(employee);
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    try {
      const [updatedEmployee] = await this.db
        .update(schema.employees)
        .set({ ...updateEmployeeDto, updatedAt: new Date() })
        .where(eq(schema.employees.id, id))
        .returning(employeeFields);

      if (!updatedEmployee) {
        throw new NotFoundException(`Employee with ID ${id} not found`);
      }

      return updatedEmployee;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Mã nhân viên hoặc email đã tồn tại, hoặc phòng ban/vai trò không hợp lệ.',
        );
      }

      throw new InternalServerErrorException('Không thể cập nhật nhân viên.');
    }
  }

  async remove(id: string) {
    const result = await this.db
      .delete(schema.employees)
      .where(eq(schema.employees.id, id))
      .returning({ deletedId: schema.employees.id });

    if (result.length === 0) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return { deleted: true };
  }
}
