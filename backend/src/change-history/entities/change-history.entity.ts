export class ChangeHistory {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: unknown;
  newData?: unknown;
  performedByEmployeeId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;

  constructor(partial: Partial<ChangeHistory>) {
    Object.assign(this, partial);
  }
}
