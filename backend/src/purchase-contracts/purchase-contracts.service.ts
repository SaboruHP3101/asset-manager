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
import { CreatePurchaseContractDto } from './dto/create-purchase-contract.dto.js';
import { UpdatePurchaseContractDto } from './dto/update-purchase-contract.dto.js';
import { PurchaseContract } from './entities/purchase-contract.entity.js';

@Injectable()
export class PurchaseContractsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createPurchaseContractDto: CreatePurchaseContractDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.purchaseContracts)
        .values(createPurchaseContractDto)
        .returning();

      return new PurchaseContract(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hợp đồng mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo hợp đồng mua sắm');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseContracts);

    return records.map((record) => new PurchaseContract(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseContracts)
      .where(eq(schema.purchaseContracts.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy hợp đồng mua sắm có ID ${id}`,
      );
    }

    return new PurchaseContract(record);
  }

  async update(
    id: string,
    updatePurchaseContractDto: UpdatePurchaseContractDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseContracts)
        .set({
          ...updatePurchaseContractDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseContracts.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy hợp đồng mua sắm có ID ${id}`,
        );
      }

      return new PurchaseContract(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hợp đồng mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật hợp đồng mua sắm',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseContracts)
        .where(eq(schema.purchaseContracts.id, id))
        .returning({ deletedId: schema.purchaseContracts.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy hợp đồng mua sắm có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa hợp đồng mua sắm vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa hợp đồng mua sắm');
    }
  }
}
