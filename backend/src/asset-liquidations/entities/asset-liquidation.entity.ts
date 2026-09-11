export class AssetLiquidation {
  id: string;
  proposedByEmployeeId: string;
  proposedDate: string;
  approvedDate?: string | null;
  liquidationDate?: string | null;
  status: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetLiquidation>) {
    Object.assign(this, partial);
  }
}
