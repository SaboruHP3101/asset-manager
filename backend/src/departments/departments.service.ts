import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { Department } from './entities/department.entity.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    try {
      const [newDepartment] = await this.db
        .insert(schema.departments)
        .values(createDepartmentDto)
        .returning();

      return new Department(newDepartment);
    } catch (error: any) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException();
      }

      throw new InternalServerErrorException();
    }
  }

  async findAll() {
    return (await this.db.select().from(schema.departments)) as Department[];
  }

  async findOne(id: string) {
    const [department] = await this.db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, id));

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return new Department(department);
  }

  async update(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
  ): Promise<Department> {
    const [updatedDepartment] = await this.db
      .update(schema.departments)
      .set({
        ...updateDepartmentDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.departments.id, id))
      .returning();

    if (!updatedDepartment) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return new Department(updatedDepartment);
  }

  async remove(id: string) {
    const result = await this.db
      .delete(schema.departments)
      .where(eq(schema.departments.id, id))
      .returning({ deletedId: schema.departments.id });

    if (result.length === 0) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return { deleted: true };
  }
}
