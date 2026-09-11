export class PurchaseOrderRequest {
  id: string;
  purchaseOrderId: string;
  purchaseRequestId: string;
  createdAt: Date;

  constructor(partial: Partial<PurchaseOrderRequest>) {
    Object.assign(this, partial);
  }
}
