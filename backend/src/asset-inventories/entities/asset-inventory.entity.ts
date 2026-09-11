export class AssetInventory {
  id: string;
  assetId: string;
  inspectedByEmployeeId: string;
  inspectionDate: string;
  completionDate?: string | null;
  actualStatus: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetInventory>) {
    Object.assign(this, partial);
  }
}
