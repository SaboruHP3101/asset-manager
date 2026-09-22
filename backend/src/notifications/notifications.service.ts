import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

export const PURCHASE_NOTIFICATION_EVENTS = [
  'purchase_request_submitted',
  'purchase_request_returned_for_revision',
  'purchase_request_ready_for_procurement',
  'purchase_request_ready_for_procurement_head',
  'purchase_request_ready_for_it_head',
  'purchase_request_approved',
  'purchase_order_pending_approval',
  'purchase_order_issued',
  'purchase_order_rejected',
  'purchase_receipt_pending_inspection',
  'purchase_receipt_inspection_completed',
  'purchase_receipt_has_rejected_items',
  'asset_pending_initial_allocation',
  'asset_allocation_pending_confirmation',
  'asset_allocation_rejected',
  'asset_pending_reallocation',
  'asset_activated',
] as const;

export type PurchaseNotificationEvent =
  (typeof PURCHASE_NOTIFICATION_EVENTS)[number];
export type NotificationEntityType =
  'request' | 'order' | 'receipt' | 'asset' | 'allocation';

export interface CreateNotificationEntry {
  recipientId: string;
  eventType: PurchaseNotificationEvent;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
/** Hạ tầng notification nội bộ; caller truyền transaction của nghiệp vụ. */
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(
    db: NodePgDatabase<typeof schema>,
    entry: CreateNotificationEntry,
  ): Promise<void> {
    await db.insert(schema.notifications).values({
      ...entry,
      metadata: entry.metadata ?? null,
    });
  }

  async createMany(
    db: NodePgDatabase<typeof schema>,
    entries: readonly CreateNotificationEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;

    await db.insert(schema.notifications).values(
      entries.map((entry) => ({
        ...entry,
        metadata: entry.metadata ?? null,
      })),
    );
  }

  /** Chỉ trả notification cho đúng người nhận, không làm lộ bản ghi của người khác. */
  async findRecipientNotification(id: string, recipientId: string) {
    const [notification] = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.recipientId, recipientId),
        ),
      );

    if (!notification) throw new NotFoundException('Notification not found.');

    return notification;
  }
}
