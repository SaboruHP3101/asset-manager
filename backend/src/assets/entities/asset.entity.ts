export class Asset {
  id: string;
  assetCode: string;
  qrCode: string;
  assetCategoryId: string;
  supplierId: string;
  currentUserId?: string | null;
  currentManagingDepartmentId?: string | null;
  purchaseOrderItemId?: string | null;
  status: string;
  initialValue: string;
  purchaseDate: string;
  inServiceDate: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<Asset>) {
    Object.assign(this, partial);
  }
}
