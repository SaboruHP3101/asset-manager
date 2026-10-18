import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetCategoriesService } from './asset-categories.service.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

describe('AssetCategoriesService', () => {
  let service: AssetCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetCategoriesService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<AssetCategoriesService>(AssetCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns only categories configured as purchase options', async () => {
    const rows = [
      {
        id: 'computers-id',
        code: 'MT',
        name: 'Máy tính',
        isPurchaseOption: true,
      },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const filteredService = new AssetCategoriesService({
      select: vi.fn(() => ({ from })),
    } as never);

    const result = await filteredService.findPurchaseOptions();

    expect(where).toHaveBeenCalledOnce();
    expect(orderBy).toHaveBeenCalledOnce();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'computers-id',
        name: 'Máy tính',
        isPurchaseOption: true,
      }),
    ]);
  });

  describe('root category writes', () => {
    const root = {
      id: 'root',
      code: 'ROOT',
      name: 'Root',
      parentCategoryId: null,
      managementOwner: 'it',
      trackingMode: 'individual_asset',
    };
    const child = {
      id: 'child',
      code: 'CHILD',
      name: 'Child',
      parentCategoryId: 'root',
    };
    let where: ReturnType<typeof vi.fn>;
    let returning: ReturnType<typeof vi.fn>;
    let values: ReturnType<typeof vi.fn>;
    let set: ReturnType<typeof vi.fn>;
    let transaction: ReturnType<typeof vi.fn>;
    let txWhere: ReturnType<typeof vi.fn>;
    let txReturning: ReturnType<typeof vi.fn>;
    let txFrom: ReturnType<typeof vi.fn>;
    let db: {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      transaction: ReturnType<typeof vi.fn>;
    };
    let subject: AssetCategoriesService;

    beforeEach(() => {
      where = vi.fn();
      returning = vi.fn();
      values = vi.fn(() => ({ returning }));
      set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
      txReturning = vi.fn();
      txWhere = vi.fn(() => ({ returning: txReturning }));
      txFrom = vi.fn();
      const tx = {
        select: vi.fn(() => ({ from: txFrom })),
        delete: vi.fn(() => ({ where: txWhere })),
      };

      transaction = vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      );
      db = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
        insert: vi.fn(() => ({ values })),
        update: vi.fn(() => ({ set })),
        delete: vi.fn(() => ({ where: vi.fn(() => ({ returning })) })),
        transaction,
      };
      subject = new AssetCategoriesService(db as never);
    });

    it('creates a root with selected ownership and tracking settings', async () => {
      const input = {
        code: 'ROOT',
        name: 'Root',
        managementOwner: 'it' as const,
        trackingMode: 'consumable' as const,
      };

      returning.mockResolvedValue([{ ...root, ...input }]);

      await expect(subject.create(input)).resolves.toMatchObject({
        ...input,
        parentCategoryId: null,
      });
      expect(values).toHaveBeenCalledWith(input);
    });

    it('returns a conflict for duplicate category codes', async () => {
      returning.mockRejectedValue(
        new DrizzleQueryError(
          'insert',
          [],
          Object.assign(new Error('duplicate'), { code: '23505' }),
        ),
      );

      await expect(
        subject.create({
          code: 'ROOT',
          name: 'Root',
          managementOwner: 'it',
          trackingMode: 'individual_asset',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates root metadata without changing ownership or tracking', async () => {
      where.mockResolvedValue([root]);
      returning.mockResolvedValue([{ ...root, name: 'Updated' }]);

      await expect(
        subject.update('root', { name: 'Updated' }),
      ).resolves.toMatchObject({
        name: 'Updated',
        managementOwner: 'it',
        trackingMode: 'individual_asset',
      });
      expect(set).toHaveBeenCalledWith({
        code: undefined,
        name: 'Updated',
        description: undefined,
        updatedAt: expect.any(Date),
      });
    });

    it('rejects writes to children and missing categories before mutation', async () => {
      where.mockResolvedValue([child]);

      await expect(
        subject.update('child', { name: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
      await expect(subject.remove('child')).rejects.toThrow(
        BadRequestException,
      );
      await expect(subject.remove('child', true)).rejects.toThrow(
        BadRequestException,
      );
      where.mockResolvedValue([]);
      await expect(subject.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(db.update).not.toHaveBeenCalled();
      expect(db.delete).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('blocks deletion and returns child codes and names', async () => {
      where.mockResolvedValueOnce([root]).mockResolvedValueOnce([child]);

      try {
        await subject.remove('root');
        expect.fail('Expected deletion to be blocked');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toMatchObject({
          children: [child],
        });
      }

      expect(db.delete).not.toHaveBeenCalled();
    });

    it('deletes only an unreferenced root', async () => {
      where.mockResolvedValueOnce([root]).mockResolvedValueOnce([]);
      returning.mockResolvedValue([{ deletedId: 'root' }]);

      await expect(subject.remove('root')).resolves.toEqual({ deleted: true });
      expect(transaction).not.toHaveBeenCalled();
    });

    it('force deletes the complete selected branch, excluding unrelated categories', async () => {
      where.mockResolvedValue([root]);
      txFrom.mockResolvedValue([
        { id: 'grandchild', parentCategoryId: 'child' },
        { id: 'unrelated-child', parentCategoryId: 'unrelated-root' },
        root,
        child,
        { id: 'unrelated-root', parentCategoryId: null },
      ]);
      txReturning.mockResolvedValue([
        { deletedId: 'root' },
        { deletedId: 'child' },
        { deletedId: 'grandchild' },
      ]);

      await expect(subject.remove('root', true)).resolves.toEqual({
        deleted: true,
      });
      expect(transaction).toHaveBeenCalledOnce();
      expect(
        new PgDialect().sqlToQuery(txWhere.mock.calls[0][0]).params,
      ).toEqual(['root', 'child', 'grandchild']);
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('rejects a force deletion when any descendant has referencing data', async () => {
      where.mockResolvedValue([root]);
      txFrom.mockResolvedValue([root, child]);
      txReturning.mockRejectedValue(
        new DrizzleQueryError(
          'delete',
          [],
          Object.assign(new Error('referenced child'), { code: '23503' }),
        ),
      );

      await expect(subject.remove('root', true)).rejects.toThrow(
        ConflictException,
      );
      expect(transaction).toHaveBeenCalledOnce();
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('reports referencing data as a conflict and unexpected errors as server errors', async () => {
      where.mockResolvedValueOnce([root]).mockResolvedValueOnce([]);
      returning.mockRejectedValueOnce(
        new DrizzleQueryError(
          'delete',
          [],
          Object.assign(new Error('referenced'), { code: '23503' }),
        ),
      );

      await expect(subject.remove('root')).rejects.toThrow(ConflictException);
      where.mockResolvedValueOnce([root]).mockResolvedValueOnce([]);
      returning.mockRejectedValueOnce(new Error('offline'));
      await expect(subject.remove('root')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
