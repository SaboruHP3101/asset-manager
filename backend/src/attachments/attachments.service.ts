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
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { UpdateAttachmentDto } from './dto/update-attachment.dto.js';
import { Attachment } from './entities/attachment.entity.js';

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAttachmentDto: CreateAttachmentDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.attachments)
        .values(createAttachmentDto)
        .returning();

      return new Attachment(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu tệp đính kèm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo tệp đính kèm');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.attachments);

    return records.map((record) => new Attachment(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy tệp đính kèm có ID ${id}`);
    }

    return new Attachment(record);
  }

  async update(id: string, updateAttachmentDto: UpdateAttachmentDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.attachments)
        .set({
          ...updateAttachmentDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.attachments.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(`Không tìm thấy tệp đính kèm có ID ${id}`);
      }

      return new Attachment(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu tệp đính kèm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException('Không thể cập nhật tệp đính kèm');
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.attachments)
        .where(eq(schema.attachments.id, id))
        .returning({ deletedId: schema.attachments.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(`Không tìm thấy tệp đính kèm có ID ${id}`);
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa tệp đính kèm vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa tệp đính kèm');
    }
  }
}
