import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { MAX_IMAGE_SIZE_BYTES } from '../common/utils/image-upload.validator';

// GEN-08: hotel photos are JPG or PNG, max 5 MB each, at most 5 per hotel
export const HOTEL_PHOTO_DIR = join(process.cwd(), 'uploads', 'hotels');
export const HOTEL_PHOTO_URL_PREFIX = '/uploads/hotels/';
export const MAX_HOTEL_PHOTOS = 5;

export const hotelPhotoUploadOptions: MulterOptions = {
    storage: diskStorage({
        destination: (_req, _file, cb) => {
            mkdirSync(HOTEL_PHOTO_DIR, { recursive: true });
            cb(null, HOTEL_PHOTO_DIR);
        },
        // random name, extension from the MIME type: the client's file name is never used
        filename: (_req, file, cb) =>
            cb(null, `${randomUUID()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
    }),
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) =>
        ['image/jpeg', 'image/png'].includes(file.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException('Only JPG or PNG images are allowed'), false),
};
