import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { diskStorage } from 'multer';

const uploadFolder = 'uploads/purchase-quotes';

export const purchaseQuoteUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      mkdirSync(uploadFolder, { recursive: true });
      callback(null, uploadFolder);
    },
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const imageExtension = /\.(jpg|jpeg|png|gif|webp|heic)$/i;
    const allowed =
      file.mimetype.startsWith('image/') &&
      imageExtension.test(file.originalname);
    callback(
      allowed ? null : new Error('Chỉ chấp nhận tệp ảnh báo giá.'),
      allowed,
    );
  },
});
