import { describe, expect, it } from 'vitest';
import {
  calculateReceiptProgress,
  validateReceiptSerialNumbers,
} from './purchase-receipts.service.js';

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

describe('validateReceiptSerialNumbers', () => {
  it('chuẩn hóa khoảng trắng và giữ nguyên giá trị mã', () => {
    expect(
      validateReceiptSerialNumbers(['  QR-AbC-001  '], 1, true, 'Laptop'),
    ).toEqual(['QR-AbC-001']);
  });

  it('từ chối mã trùng trong cùng hạng mục', () => {
    expect(() =>
      validateReceiptSerialNumbers(['QR-001', 'QR-001'], 2, true, 'Laptop'),
    ).toThrow('có mã bị trùng');
  });

  it('yêu cầu đủ mã cho tài sản quản lý riêng từng chiếc', () => {
    expect(() =>
      validateReceiptSerialNumbers(['QR-001'], 2, true, 'Laptop'),
    ).toThrow('cần đủ 2 mã sản phẩm');
  });

  it('không yêu cầu mã cho vật tư theo số lượng', () => {
    expect(validateReceiptSerialNumbers(undefined, 20, false, 'Giấy')).toEqual(
      [],
    );
  });
});
