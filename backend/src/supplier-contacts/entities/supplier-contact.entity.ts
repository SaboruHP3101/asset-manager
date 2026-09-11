export class SupplierContact {
  id: string;
  supplierId: string;
  fullName: string;
  position?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  isPrimaryContact?: boolean | null;

  constructor(partial: Partial<SupplierContact>) {
    Object.assign(this, partial);
  }
}
