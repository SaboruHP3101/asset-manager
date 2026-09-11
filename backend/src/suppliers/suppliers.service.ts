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
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { Supplier } from './entities/supplier.entity.js';

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.suppliers)
        .values(createSupplierDto)
        .returning();

      return new Supplier(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo nhà cung cấp');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.suppliers);

    return records.map((record) => new Supplier(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy nhà cung cấp có ID ${id}`);
    }

    return new Supplier(record);
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.suppliers)
        .set({
          ...updateSupplierDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.suppliers.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(`Không tìm thấy nhà cung cấp có ID ${id}`);
      }

      return new Supplier(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException('Không thể cập nhật nhà cung cấp');
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.suppliers)
        .where(eq(schema.suppliers.id, id))
        .returning({ deletedId: schema.suppliers.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(`Không tìm thấy nhà cung cấp có ID ${id}`);
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa nhà cung cấp vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa nhà cung cấp');
    }
  }
}
