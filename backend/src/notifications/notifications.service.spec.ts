import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  it('insert notification bằng transaction do workflow truyền vào', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const transaction = { insert: vi.fn(() => ({ values })) };
    const service = new NotificationsService({} as never);

    await service.create(transaction as never, {
      recipientId: 'recipient-id',
      eventType: 'purchase_request_submitted',
      entityType: 'request',
      entityId: 'request-id',
      title: 'Có đề nghị mua mới',
      body: 'Đề nghị đang chờ xử lý.',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'recipient-id',
        eventType: 'purchase_request_submitted',
        metadata: null,
      }),
    );
  });

  it('không trả notification không thuộc người nhận', async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    };
    const service = new NotificationsService(db as never);

    await expect(
      service.findRecipientNotification('notification-id', 'recipient-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
