import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { diskStorage } from 'multer';

const uploadFolder = 'uploads/purchase-receipts';
const imageExtension = /\.(jpg|jpeg|png|gif|webp|heic)$/i;

const storage = diskStorage({
  destination: (_request, _file, callback) => {
    mkdirSync(uploadFolder, { recursive: true });
    callback(null, uploadFolder);
  },
  filename: (_request, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

const imageFileFilter = (
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowed =
    file.mimetype.startsWith('image/') && imageExtension.test(file.originalname);

  callback(
    allowed ? null : new Error('Chỉ chấp nhận tệp ảnh chứng từ.'),
    allowed,
  );
};

export const purchaseReceiptUpload = FileFieldsInterceptor(
  [
    { name: 'deliveryNote', maxCount: 1 },
    { name: 'invoice', maxCount: 1 },
    { name: 'warranty', maxCount: 1 },
  ],
  {
    storage,
    limits: { files: 3, fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  },
);

export const purchaseInspectionUpload = FileFieldsInterceptor(
  [{ name: 'evidence', maxCount: 1 }],
  {
    storage,
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  },
);
