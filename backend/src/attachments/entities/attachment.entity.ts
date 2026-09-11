export class Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedByEmployeeId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Attachment>) {
    Object.assign(this, partial);
  }
}
