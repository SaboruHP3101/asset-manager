export class SupplierAddress {
  id: string;
  supplierId: string;
  addressType: string;
  address: string;
  provinceCity?: string | null;
  country: string;

  constructor(partial: Partial<SupplierAddress>) {
    Object.assign(this, partial);
  }
}
