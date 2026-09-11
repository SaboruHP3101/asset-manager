export class AssetDepreciation {
  id: string;
  assetId: string;
  fromDate: string;
  toDate: string;
  openingValue: string;
  depreciationAmount: string;
  remainingValue: string;
  depreciationMethod: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetDepreciation>) {
    Object.assign(this, partial);
  }
}
