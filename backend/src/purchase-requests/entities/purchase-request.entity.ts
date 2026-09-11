export class PurchaseRequest {
  id: string;
  requesterId: string;
  departmentId: string;
  assetCategoryId: string;
  quantity: number;
  requestDate: string;
  status: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<PurchaseRequest>) {
    Object.assign(this, partial);
  }
}
