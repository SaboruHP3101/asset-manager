export class PurchaseContract {
  id: string;
  contractNumber: string;
  supplierId: string;
  signedDate: string;
  effectiveDate: string;
  expirationDate: string;
  contractValue: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<PurchaseContract>) {
    Object.assign(this, partial);
  }
}
