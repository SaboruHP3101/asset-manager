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
import { CreateApprovalHistoryDto } from './dto/create-approval-history.dto.js';
import { UpdateApprovalHistoryDto } from './dto/update-approval-history.dto.js';
import { ApprovalHistory } from './entities/approval-history.entity.js';

@Injectable()
export class ApprovalHistoryService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createApprovalHistoryDto: CreateApprovalHistoryDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.approvalHistory)
        .values(createApprovalHistoryDto)
        .returning();

      return new ApprovalHistory(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử phê duyệt đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo lịch sử phê duyệt');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.approvalHistory);

    return records.map((record) => new ApprovalHistory(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.approvalHistory)
      .where(eq(schema.approvalHistory.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy lịch sử phê duyệt có ID ${id}`,
      );
    }

    return new ApprovalHistory(record);
  }

  async update(id: string, updateApprovalHistoryDto: UpdateApprovalHistoryDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.approvalHistory)
        .set({
          ...updateApprovalHistoryDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.approvalHistory.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử phê duyệt có ID ${id}`,
        );
      }

      return new ApprovalHistory(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử phê duyệt đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật lịch sử phê duyệt',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.approvalHistory)
        .where(eq(schema.approvalHistory.id, id))
        .returning({ deletedId: schema.approvalHistory.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử phê duyệt có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa lịch sử phê duyệt vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa lịch sử phê duyệt');
    }
  }
}
