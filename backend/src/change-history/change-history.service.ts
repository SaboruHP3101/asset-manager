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
import { CreateChangeHistoryDto } from './dto/create-change-history.dto.js';
import { UpdateChangeHistoryDto } from './dto/update-change-history.dto.js';
import { ChangeHistory } from './entities/change-history.entity.js';

@Injectable()
export class ChangeHistoryService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createChangeHistoryDto: CreateChangeHistoryDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.changeHistory)
        .values(createChangeHistoryDto)
        .returning();

      return new ChangeHistory(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử thay đổi đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo lịch sử thay đổi');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.changeHistory);

    return records.map((record) => new ChangeHistory(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.changeHistory)
      .where(eq(schema.changeHistory.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy lịch sử thay đổi có ID ${id}`,
      );
    }

    return new ChangeHistory(record);
  }

  async update(id: string, updateChangeHistoryDto: UpdateChangeHistoryDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.changeHistory)
        .set({
          ...updateChangeHistoryDto,
        })
        .where(eq(schema.changeHistory.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử thay đổi có ID ${id}`,
        );
      }

      return new ChangeHistory(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử thay đổi đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật lịch sử thay đổi',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.changeHistory)
        .where(eq(schema.changeHistory.id, id))
        .returning({ deletedId: schema.changeHistory.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử thay đổi có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa lịch sử thay đổi vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException('Không thể xóa lịch sử thay đổi');
    }
  }
}
