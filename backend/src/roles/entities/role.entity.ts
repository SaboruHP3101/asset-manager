export class Role {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(partial: Partial<Role>) {
    Object.assign(this, partial);
  }
}
