import {
  calculateOrderLineTotals,
  deriveRequestOrderStatus,
} from './purchase-orders.service.js';

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
