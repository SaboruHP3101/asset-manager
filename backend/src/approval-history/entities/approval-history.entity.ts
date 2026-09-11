export class ApprovalHistory {
  id: string;
  entityType: string;
  entityId: string;
  approverId: string;
  approvalStep: number;
  action: string;
  previousStatus: string;
  newStatus: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<ApprovalHistory>) {
    Object.assign(this, partial);
  }
}
