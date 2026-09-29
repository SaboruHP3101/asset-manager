import { describe, expect, it } from 'vitest';
import { calculateReceiptProgress } from './purchase-receipts.service.js';

describe('calculateReceiptProgress', () => {
  it('không tính hàng rejected là đã hoàn thành để có thể giao bù', () => {
    expect(calculateReceiptProgress(10, 7, 4, 2)).toEqual({
      ordered: 10,
      delivered: 7,
      accepted: 4,
      rejected: 2,
      pending: 1,
      remaining: 5,
    });
  });

  it('trừ các đơn vị đang chờ kiểm tra khỏi sức chứa đợt giao mới', () => {
    expect(calculateReceiptProgress(3, 2, 0, 0).remaining).toBe(1);
  });
});
