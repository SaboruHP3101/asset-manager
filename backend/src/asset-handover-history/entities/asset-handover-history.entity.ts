export class AssetHandoverHistory {
  id: string;
  assetId: string;
  handoverType: string;
  handoverFromEmployeeId?: string | null;
  receivedByEmployeeId?: string | null;
  handoverFromDepartmentId?: string | null;
  receivedByDepartmentId?: string | null;
  handoverDate: string;
  status: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetHandoverHistory>) {
    Object.assign(this, partial);
  }
}
