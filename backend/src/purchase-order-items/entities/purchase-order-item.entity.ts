export class PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  assetCategoryId: string;
  itemName: string;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<PurchaseOrderItem>) {
    Object.assign(this, partial);
  }
}
