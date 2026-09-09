export class Department {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<Department>) {
    Object.assign(this, partial);
  }
}
