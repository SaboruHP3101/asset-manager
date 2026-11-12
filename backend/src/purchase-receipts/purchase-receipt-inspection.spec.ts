import { removeUploadedFiles } from '../attachments/upload-cleanup.js';
import type { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { RequestAuditService } from '../request-audit/request-audit.service.js';
import { inspectUnit } from './purchase-receipt-inspection.js';
import { lockOrder, requireUnitContext } from './purchase-receipt-queries.js';

vi.mock('../attachments/upload-cleanup.js', () => ({
  removeUploadedFiles: vi.fn(),
}));
vi.mock('./purchase-receipt-queries.js', () => ({
  lockOrder: vi.fn(),
  requireUnitContext: vi.fn(),
}));

describe('repeated receipt inspection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks the order before the unit and discards unused evidence on a retry', async () => {
    const asset = {
      id: 'asset-id',
      assetCode: 'AST-1',
      qrCode: 'asset:asset-id',
    };

    vi.mocked(requireUnitContext).mockResolvedValue({
      purchaseOrderId: 'order-id',
      managementOwnerSnapshot: 'it',
      inspectionResult: 'accepted',
    } as Awaited<ReturnType<typeof requireUnitContext>>);
    const db = {
      execute: vi.fn(),
      select: vi.fn(() => ({ from: () => ({ where: async () => [asset] }) })),
      transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation(db),
      ),
    };
    const authorization = {
      assertAction: vi.fn(),
      assertManagementOwner: vi.fn(),
    };
    const evidence = { path: 'unused-evidence.png' } as Express.Multer.File;

    const result = await inspectUnit(
      {} as RequestAuditService,
      authorization as unknown as PurchaseAuthorizationService,
      db as never,
      {} as NotificationsService,
      'unit-id',
      { accepted: true },
      evidence,
      { id: 'inspector' } as AuthenticatedEmployee,
    );

    expect(result).toEqual({
      unitId: 'unit-id',
      inspectionResult: 'accepted',
      asset,
    });
    expect(lockOrder).toHaveBeenCalledWith(db, 'order-id');
    expect(lockOrder).toHaveBeenCalledBefore(db.execute);
    expect(requireUnitContext).toHaveBeenCalledTimes(2);
    expect(removeUploadedFiles).toHaveBeenCalledWith([evidence]);
  });
});
