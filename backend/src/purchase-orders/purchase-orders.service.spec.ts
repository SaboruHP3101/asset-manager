import type { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  calculateOrderLineTotals,
  deriveRequestOrderStatus,
  PurchaseOrdersService,
} from './purchase-orders.service.js';

describe('PurchaseOrdersService cancellation', () => {
  it('chặn hủy đơn đã phát hành khi còn hàng chờ kiểm tra', async () => {
    const order = { purchaseRequestId: 'request-id', status: 'issued' };
    const where = vi
      .fn()
      .mockResolvedValueOnce([order])
      .mockResolvedValueOnce([order])
      .mockResolvedValueOnce([{ id: 'item-id', quantity: 1 }])
      .mockReturnValueOnce({
        groupBy: vi.fn().mockResolvedValue([
          {
            purchaseOrderItemId: 'item-id',
            delivered: 1,
            accepted: 0,
            rejected: 0,
          },
        ]),
      });
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 'request-id' }] }),
      select: vi.fn(() => ({
        from: () => ({ where, innerJoin: () => ({ where }) }),
      })),
      update: vi.fn(),
      transaction: (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    };
    const authorization = { assertAction: vi.fn(), assertDepartment: vi.fn() };
    const audit = { logPurchase: vi.fn() };
    const service = new PurchaseOrdersService(
      db as never,
      authorization as unknown as PurchaseAuthorizationService,
      audit as unknown as RequestAuditService,
      {} as NotificationsService,
    );

    await expect(
      service.cancel(
        'order-id',
        { reason: 'Không còn nhu cầu' },
        { id: 'procurement-id' } as AuthenticatedEmployee,
      ),
    ).rejects.toThrow('Không thể hủy đơn mua khi vẫn còn hàng chờ kiểm tra.');
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(db.execute.mock.invocationCallOrder[1]).toBeLessThan(
      db.select.mock.invocationCallOrder[1],
    );
    expect(db.update).not.toHaveBeenCalled();
    expect(audit.logPurchase).not.toHaveBeenCalled();
  });
});

describe('PurchaseOrdersService calculations', () => {
  it('tính tổng tiền từ quantity và giá server snapshot, gồm VAT làm tròn', () => {
    expect(calculateOrderLineTotals(3, '10001', '8.00')).toEqual({
      subtotalExclVat: '30003',
      vatAmount: '2400',
      totalInclVat: '32403',
    });
  });

  it('giữ chính xác số VND lớn hơn giới hạn integer an toàn của JavaScript', () => {
    expect(calculateOrderLineTotals(2, '9007199254740993', '10.00')).toEqual({
      subtotalExclVat: '18014398509481986',
      vatAmount: '1801439850948199',
      totalInclVat: '19815838360430185',
    });
  });

  it('chỉ fully_ordered khi mọi hạng mục đã được PO issued phủ đủ', () => {
    expect(
      deriveRequestOrderStatus(
        [
          { approved: 2, issued: 2 },
          { approved: 3, issued: 3 },
        ],
        true,
      ),
    ).toBe('fully_ordered');
    expect(deriveRequestOrderStatus([{ approved: 2, issued: 1 }], true)).toBe(
      'ordering',
    );
    expect(deriveRequestOrderStatus([{ approved: 2, issued: 0 }], false)).toBe(
      'approved',
    );
  });
});
