import type * as schema from '../db/schema.js';

type PurchaseOrderStatus =
  (typeof schema.purchaseOrderStatusEnum.enumValues)[number];

export const RESERVED_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'draft',
  'pending_procurement_head',
  'issued',
  'partially_received',
  'fully_received',
  'closed_short',
];

export const ISSUED_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'issued',
  'partially_received',
  'fully_received',
  'closed_short',
];

export function calculateOrderLineTotals(
  quantity: number,
  unitPriceExclVat: string,
  vatRate: string,
) {
  const subtotal = BigInt(unitPriceExclVat) * BigInt(quantity);
  const vatHundredths = BigInt(Math.round(Number(vatRate) * 100));
  const vatAmount = (subtotal * vatHundredths + 5000n) / 10000n;

  return {
    subtotalExclVat: subtotal.toString(),
    vatAmount: vatAmount.toString(),
    totalInclVat: (subtotal + vatAmount).toString(),
  };
}

export function deriveRequestOrderStatus(
  quantities: Array<{ approved: number; issued: number }>,
  hasActiveOrder: boolean,
): 'approved' | 'ordering' | 'fully_ordered' {
  if (quantities.every((item) => item.issued === item.approved)) {
    return 'fully_ordered';
  }

  return hasActiveOrder ? 'ordering' : 'approved';
}
