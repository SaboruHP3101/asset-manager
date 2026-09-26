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
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto.js';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto.js';
import { SupplierContact } from './entities/supplier-contact.entity.js';

@Injectable()
export class SupplierContactsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createSupplierContactDto: CreateSupplierContactDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.supplierContacts)
        .values(createSupplierContactDto)
        .returning();

      return new SupplierContact(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu liên hệ nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo liên hệ nhà cung cấp',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.supplierContacts);

    return records.map((record) => new SupplierContact(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.supplierContacts)
      .where(eq(schema.supplierContacts.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy liên hệ nhà cung cấp có ID ${id}`,
      );
    }

    return new SupplierContact(record);
  }

  async update(id: string, updateSupplierContactDto: UpdateSupplierContactDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.supplierContacts)
        .set({
          ...updateSupplierContactDto,
        })
        .where(eq(schema.supplierContacts.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy liên hệ nhà cung cấp có ID ${id}`,
        );
      }

      return new SupplierContact(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu liên hệ nhà cung cấp đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật liên hệ nhà cung cấp',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.supplierContacts)
        .where(eq(schema.supplierContacts.id, id))
        .returning({ deletedId: schema.supplierContacts.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy liên hệ nhà cung cấp có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa liên hệ nhà cung cấp vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException(
        'Không thể xóa liên hệ nhà cung cấp',
      );
    }
  }
}
