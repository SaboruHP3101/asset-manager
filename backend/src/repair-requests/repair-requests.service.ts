import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, DrizzleQueryError, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto.js';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import { CreateMyRepairRequestDto } from './dto/create-my-repair-request.dto.js';

@Injectable()
export class RepairRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createRepairRequestDto: CreateRepairRequestDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.repairRequests)
        .values(createRepairRequestDto)
        .returning();

      return new RepairRequest(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu sửa chữa đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo yêu cầu sửa chữa');
    }
  }

  // Tạo yêu cầu pending và lưu thông tin ảnh, video đi kèm
  async createMine(
    employeeId: string,
    dto: CreateMyRepairRequestDto,
    files: Express.Multer.File[],
  ) {
    const [asset] = await this.db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(
        and(
          eq(schema.assets.id, dto.assetId),
          eq(schema.assets.currentUserId, employeeId),
        ),
      );

    if (!asset) {
      throw new NotFoundException('Không tìm thấy tài sản được quản lý.');
    }

    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(schema.repairRequests)
        .values({
          assetId: dto.assetId,
          reporterId: employeeId,
          reportDate: new Date().toISOString().slice(0, 10),
          issueDescription: dto.issueDescription,
          status: 'pending',
        })
        .returning();

      if (files.length > 0) {
        await tx.insert(schema.attachments).values(
          files.map((file) => ({
            entityType: 'repair_request',
            entityId: request.id,
            fileName: file.originalname,
            url: `/uploads/repair-requests/${file.filename}`,
            mimeType: file.mimetype,
            size: file.size,
            uploadedByEmployeeId: employeeId,
          })),
        );
      }

      return new RepairRequest(request);
    });
  }

  async findAll() {
    const records = await this.db.select().from(schema.repairRequests);

    return records.map((record) => new RepairRequest(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.repairRequests)
      .where(eq(schema.repairRequests.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
      );
    }

    return new RepairRequest(record);
  }

  async update(id: string, updateRepairRequestDto: UpdateRepairRequestDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.repairRequests)
        .set({
          ...updateRepairRequestDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
        );
      }

      return new RepairRequest(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu sửa chữa đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật yêu cầu sửa chữa',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.repairRequests)
        .where(eq(schema.repairRequests.id, id))
        .returning({ deletedId: schema.repairRequests.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa yêu cầu sửa chữa vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa yêu cầu sửa chữa');
    }
  }
}
