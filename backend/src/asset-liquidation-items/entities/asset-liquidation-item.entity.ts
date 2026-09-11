export class AssetLiquidationItem {
  id: string;
  liquidationId: string;
  assetId: string;
  liquidationValue: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetLiquidationItem>) {
    Object.assign(this, partial);
  }
}
