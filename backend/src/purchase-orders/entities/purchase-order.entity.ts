export class PurchaseOrder {
  id: string;
  purchaseOrderCode: string;
  contractId?: string | null;
  supplierId: string;
  createdByEmployeeId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  totalValue: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<PurchaseOrder>) {
    Object.assign(this, partial);
  }
}
