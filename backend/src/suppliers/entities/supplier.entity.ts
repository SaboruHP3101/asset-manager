export class Supplier {
  id: string;
  supplierCode: string;
  legalName: string;
  tradeName?: string | null;
  taxCode: string;
  website?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<Supplier>) {
    Object.assign(this, partial);
  }
}
