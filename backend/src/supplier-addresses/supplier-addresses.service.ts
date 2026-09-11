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
import { CreateSupplierAddressDto } from './dto/create-supplier-address.dto.js';
import { UpdateSupplierAddressDto } from './dto/update-supplier-address.dto.js';
import { SupplierAddress } from './entities/supplier-address.entity.js';

@Injectable()
export class SupplierAddressesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createSupplierAddressDto: CreateSupplierAddressDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.supplierAddresses)
        .values(createSupplierAddressDto)
        .returning();

      return new SupplierAddress(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu địa chỉ nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo địa chỉ nhà cung cấp',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.supplierAddresses);

    return records.map((record) => new SupplierAddress(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.supplierAddresses)
      .where(eq(schema.supplierAddresses.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy địa chỉ nhà cung cấp có ID ${id}`,
      );
    }

    return new SupplierAddress(record);
  }

  async update(id: string, updateSupplierAddressDto: UpdateSupplierAddressDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.supplierAddresses)
        .set({
          ...updateSupplierAddressDto,
        })
        .where(eq(schema.supplierAddresses.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy địa chỉ nhà cung cấp có ID ${id}`,
        );
      }

      return new SupplierAddress(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu địa chỉ nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật địa chỉ nhà cung cấp',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.supplierAddresses)
        .where(eq(schema.supplierAddresses.id, id))
        .returning({ deletedId: schema.supplierAddresses.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy địa chỉ nhà cung cấp có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa địa chỉ nhà cung cấp vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException(
        'Không thể xóa địa chỉ nhà cung cấp',
      );
    }
  }
}
