import { describe, expect, it } from 'vitest';
import { allocationOutcome } from './asset-allocations.service.js';

describe('allocationOutcome', () => {
  it('giữ trạng thái chờ khi mới có một bên xác nhận', () => {
    expect(allocationOutcome('confirmed', 'pending')).toBe(
      'pending_confirmations',
    );
    expect(allocationOutcome('pending', 'confirmed')).toBe(
      'pending_confirmations',
    );
  });

  it('kích hoạt khi cả hai bên xác nhận', () => {
    expect(allocationOutcome('confirmed', 'confirmed')).toBe('confirmed');
  });

  it('ưu tiên kết quả từ chối của một trong hai bên', () => {
    expect(allocationOutcome('rejected', 'pending')).toBe('rejected');
    expect(allocationOutcome('confirmed', 'rejected')).toBe('rejected');
  });
});
