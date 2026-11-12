import { Logger } from '@nestjs/common';
import { unlink } from 'node:fs/promises';

const logger = new Logger('UploadCleanup');

/** Removes unused uploads without replacing the original workflow error. */
export async function removeUploadedFiles(
  files: readonly Pick<Express.Multer.File, 'path'>[],
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try {
        await unlink(file.path);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return;

        logger.error('Could not remove an unused upload.', error);
      }
    }),
  );
}
