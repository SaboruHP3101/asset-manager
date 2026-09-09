import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { Role } from './entities/role.entity.js';

@Injectable()
export class RolesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    try {
      const [newRole] = await this.db
        .insert(schema.roles)
        .values(createRoleDto)
        .returning();

      return new Role(newRole);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException('A role with this name already exists');
      }

      throw new InternalServerErrorException('Unable to create role');
    }
  }

  async findAll() {
    const roles = await this.db.select().from(schema.roles);

    return roles.map((role) => new Role(role));
  }

  async findOne(id: string) {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.id, id));

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return new Role(role);
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const [updatedRole] = await this.db
      .update(schema.roles)
      .set({
        ...updateRoleDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.roles.id, id))
      .returning();

    if (!updatedRole) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return new Role(updatedRole);
  }

  async remove(id: string) {
    const deletedRoles = await this.db
      .delete(schema.roles)
      .where(eq(schema.roles.id, id))
      .returning({ deletedId: schema.roles.id });

    if (deletedRoles.length === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return { deleted: true };
  }
}
