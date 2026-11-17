import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { isConstraintViolation } from '../db/query-errors.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { Employee } from './entities/employee.entity.js';

const employeeFields = {
  id: schema.employees.id,
  employeeCode: schema.employees.employeeCode,
  fullName: schema.employees.fullName,
  email: schema.employees.email,
  phoneNumber: schema.employees.phoneNumber,
  departmentId: schema.employees.departmentId,
  isDepartmentHead: schema.employees.isDepartmentHead,
  isActive: schema.employees.isActive,
};

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      const [newEmployee] = await this.db
        .insert(schema.employees)
        .values(createEmployeeDto)
        .returning(employeeFields);

      return newEmployee;
    } catch (error: unknown) {
      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Mã nhân viên hoặc email đã tồn tại, hoặc phòng ban không hợp lệ.',
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

      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Mã nhân viên hoặc email đã tồn tại, hoặc phòng ban không hợp lệ.',
        );
      }

      throw new InternalServerErrorException('Không thể cập nhật nhân viên.', {
        cause: error,
      });
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
