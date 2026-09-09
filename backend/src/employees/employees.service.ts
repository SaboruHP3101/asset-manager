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
        .returning();

      return new Employee(newEmployee);
    } catch (error: any) {
      console.log(error);
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException();
      }

      throw new InternalServerErrorException();
    }
  }

  async findAll() {
    return (await this.db.select().from(schema.employees)) as Employee[];
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
    const [updatedEmployee] = await this.db
      .update(schema.employees)
      .set(updateEmployeeDto)
      .where(eq(schema.employees.id, id))
      .returning();

    if (!updatedEmployee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return new Employee(updatedEmployee);
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
