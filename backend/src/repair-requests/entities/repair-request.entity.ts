export class RepairRequest {
  id: string;
  assetId: string;
  reporterId: string;
  reportDate: string;
  issueDescription: string;
  status: string;
  repairCost?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<RepairRequest>) {
    Object.assign(this, partial);
  }
}
