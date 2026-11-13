import { Test, TestingModule } from '@nestjs/testing';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import type { CreateAssetDto } from './dto/create-asset.dto.js';

describe('AssetsController', () => {
  let controller: AssetsController;
  const findAll = vi.fn();
  const findMine = vi.fn();
  const findHistory = vi.fn();
  const update = vi.fn();
  const createAsset = vi.fn();
  const removeAsset = vi.fn();
  const getEmployeeId = vi.fn();
  const actor: AuthenticatedEmployee = {
    id: 'employee-id',
    email: 'it@example.com',
    roleId: 'role-id',
    roleName: 'EMPLOYEE',
    departmentId: 'department-id',
    departmentName: 'IT',
    isDepartmentHead: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AssetsService,
          useValue: {
            findAll,
            findMine,
            findHistory,
            update,
            create: createAsset,
            remove: removeAsset,
          },
        },
        { provide: AuthService, useValue: { getEmployeeId } },
      ],
    }).compile();

    vi.clearAllMocks();
    controller = new AssetsController(
      module.get(AssetsService),
      module.get(AuthService),
    );
  });

  it('guards the listing and update, leaving personal routes unchanged', () => {
    for (const method of ['create', 'remove', 'findHistory'] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          AssetsController.prototype[method],
        ),
      ).toContain(JwtAuthGuard);
    }

    expect(
      Reflect.getMetadata(GUARDS_METADATA, AssetsController.prototype.findAll),
    ).toContain(JwtAuthGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AssetsController.prototype.update),
    ).toContain(JwtAuthGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AssetsController),
    ).toBeUndefined();

    for (const method of [
      'findMine',
      'findMyParentCategories',
      'findMineById',
    ] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          AssetsController.prototype[method],
        ),
      ).toBeUndefined();
    }
  });

  it('rejects non-IT asset creation, deletion, and history reads', () => {
    const outsider = { ...actor, departmentName: 'ACCOUNTING' };

    expect(() => controller.create({} as CreateAssetDto, outsider)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.remove('asset-id', outsider)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.findHistory('asset-id', outsider)).toThrow(
      ForbiddenException,
    );
    expect(findHistory).not.toHaveBeenCalled();
    expect(createAsset).not.toHaveBeenCalled();
    expect(removeAsset).not.toHaveBeenCalled();
  });

  it('allows IT staff and heads to create and delete assets', async () => {
    const dto: CreateAssetDto = {
      assetCode: 'A1',
      qrCode: 'QR1',
      assetCategoryId: 'category',
      supplierId: 'supplier',
      status: 'available',
      initialValue: '100',
      purchaseDate: '2026-11-01',
      inServiceDate: '2026-11-01',
    };

    createAsset.mockResolvedValue({ id: 'asset' });
    removeAsset.mockResolvedValue({ deleted: true });

    for (const isDepartmentHead of [false, true]) {
      await expect(
        controller.create(dto, { ...actor, isDepartmentHead }),
      ).resolves.toEqual({ id: 'asset' });
      await expect(
        controller.remove('asset', { ...actor, isDepartmentHead }),
      ).resolves.toEqual({ deleted: true });
    }
  });

  it('allows both IT staff and the IT head regardless of role label', async () => {
    const rows = [{ assetCode: 'TS-02' }, { assetCode: 'TS-01' }];

    findAll.mockResolvedValue(rows);

    for (const isDepartmentHead of [false, true]) {
      await expect(
        controller.findAll({ ...actor, isDepartmentHead }),
      ).resolves.toEqual(rows);
    }
  });

  it('rejects non-IT employees before querying the full list', () => {
    expect(() =>
      controller.findAll({ ...actor, departmentName: 'ACCOUNTING' }),
    ).toThrow(ForbiddenException);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('still scopes personal assets by the authenticated employee', async () => {
    getEmployeeId.mockResolvedValue('accounting-employee');
    findMine.mockResolvedValue([]);

    await expect(controller.findMine('Bearer token')).resolves.toEqual([]);
    expect(getEmployeeId).toHaveBeenCalledWith('Bearer token');
    expect(findMine).toHaveBeenCalledWith(
      'accounting-employee',
      undefined,
      undefined,
      undefined,
    );
  });

  it('allows IT staff and heads to update metadata, rejecting other departments', async () => {
    const values = { name: 'Updated laptop' };

    update.mockResolvedValue({ id: 'asset-id', ...values });

    for (const isDepartmentHead of [false, true]) {
      await expect(
        controller.update('asset-id', values, { ...actor, isDepartmentHead }),
      ).resolves.toEqual({ id: 'asset-id', ...values });
    }

    expect(update).toHaveBeenCalledWith('asset-id', values, actor.id);
    update.mockClear();
    expect(() =>
      controller.update('asset-id', values, {
        ...actor,
        departmentName: 'ACCOUNTING',
      }),
    ).toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns edit and handover history for the selected asset', async () => {
    const history = { changes: [], handovers: [] };

    findHistory.mockResolvedValue(history);
    await expect(controller.findHistory('asset-id', actor)).resolves.toEqual(
      history,
    );
    expect(findHistory).toHaveBeenCalledWith('asset-id');
  });

  it('validates editable fields and rejects workflow or unknown fields', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = { type: 'body' as const, metatype: UpdateAssetDto };
    const values = {
      assetCode: 'TS-01',
      name: 'Laptop',
      assetCategoryId: '11111111-1111-4111-8111-111111111111',
      supplierId: '22222222-2222-4222-8222-222222222222',
      initialValue: '25000000',
      purchaseDate: '2026-10-01',
      inServiceDate: '2026-10-02',
    };

    await expect(pipe.transform(values, metadata)).resolves.toMatchObject(
      values,
    );

    for (const field of [
      'status',
      'currentUserId',
      'currentManagingDepartmentId',
      'currentWarehouseId',
      'currentLocation',
      'qrCode',
      'id',
    ]) {
      await expect(
        pipe.transform({ [field]: 'unexpected' }, metadata),
      ).rejects.toThrow();
    }

    for (const invalid of [
      { assetCode: '' },
      { name: 'x'.repeat(256) },
      { assetCategoryId: 'invalid' },
      { initialValue: 'abc' },
      { purchaseDate: 'invalid' },
    ]) {
      await expect(pipe.transform(invalid, metadata)).rejects.toThrow();
    }
  });
});
