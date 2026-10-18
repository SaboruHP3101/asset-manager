import { Test, TestingModule } from '@nestjs/testing';
import { AssetCategoriesController } from './asset-categories.controller.js';
import { AssetCategoriesService } from './asset-categories.service.js';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';

describe('AssetCategoriesController', () => {
  let controller: AssetCategoriesController;
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const actor: AuthenticatedEmployee = {
    id: 'employee-id',
    email: 'it@example.com',
    roleId: 'role-id',
    roleName: 'EMPLOYEE',
    departmentId: 'department-id',
    departmentName: 'IT',
    isDepartmentHead: false,
  };
  const values: CreateAssetCategoryDto = {
    code: 'IT',
    name: 'Thiết bị IT',
    managementOwner: 'it',
    trackingMode: 'individual_asset',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AssetCategoriesService,
          useValue: { create, update, remove },
        },
      ],
    }).compile();

    vi.clearAllMocks();
    controller = new AssetCategoriesController(
      module.get(AssetCategoriesService),
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('guards writes while preserving mobile read endpoints', () => {
    for (const method of ['create', 'update', 'remove'] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          AssetCategoriesController.prototype[method],
        ),
      ).toContain(JwtAuthGuard);
    }

    for (const method of [
      'findAll',
      'findOne',
      'findPurchaseOptions',
    ] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          AssetCategoriesController.prototype[method],
        ),
      ).toBeUndefined();
    }
  });

  it('allows IT staff and heads to write and rejects other departments', () => {
    for (const isDepartmentHead of [false, true]) {
      controller.create(values, { ...actor, isDepartmentHead });
      controller.update(
        'id',
        { name: 'Updated' },
        { ...actor, isDepartmentHead },
      );
      controller.remove('id', { ...actor, isDepartmentHead });
    }

    expect(create).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    const other = { ...actor, departmentName: 'PROCUREMENT' };

    expect(() => controller.create(values, other)).toThrow(ForbiddenException);
    expect(() => controller.update('id', {}, other)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.remove('id', other)).toThrow(ForbiddenException);
    expect(create).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('validates creation and rejects parent or workflow flags', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = {
      type: 'body' as const,
      metatype: CreateAssetCategoryDto,
    };

    await expect(pipe.transform(values, metadata)).resolves.toMatchObject(
      values,
    );

    for (const invalid of [
      { ...values, code: ' ' },
      { ...values, name: '' },
      { ...values, code: 'x'.repeat(101) },
      { ...values, name: 'x'.repeat(256) },
      { ...values, managementOwner: 'unknown' },
      { ...values, trackingMode: 'unknown' },
      { ...values, parentCategoryId: 'parent' },
      { ...values, isPurchaseOption: true },
      { ...values, allowsCustomType: true },
    ]) {
      await expect(pipe.transform(invalid, metadata)).rejects.toThrow();
    }
  });

  it('passes explicit force confirmation to the service, defaulting to false', () => {
    controller.remove('root', actor);
    expect(remove).toHaveBeenLastCalledWith('root', false);
    controller.remove('root', actor, true);
    expect(remove).toHaveBeenLastCalledWith('root', true);
    expect(() =>
      controller.remove(
        'root',
        { ...actor, departmentName: 'PROCUREMENT' },
        true,
      ),
    ).toThrow(ForbiddenException);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('allows metadata edits but rejects ownership, tracking and parent changes', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = {
      type: 'body' as const,
      metatype: UpdateAssetCategoryDto,
    };

    await expect(
      pipe.transform({ name: 'Updated', description: '' }, metadata),
    ).resolves.toMatchObject({ name: 'Updated', description: '' });

    for (const field of [
      'managementOwner',
      'trackingMode',
      'parentCategoryId',
    ]) {
      await expect(
        pipe.transform({ [field]: 'unexpected' }, metadata),
      ).rejects.toThrow();
    }
  });
});
