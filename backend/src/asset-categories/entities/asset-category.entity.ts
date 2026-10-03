export class AssetCategory {
  id: string;
  code: string;
  name: string;
  parentCategoryId?: string | null;
  description?: string | null;
  isPurchaseOption: boolean;
  allowsCustomType: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<AssetCategory>) {
    Object.assign(this, partial);
  }
}
