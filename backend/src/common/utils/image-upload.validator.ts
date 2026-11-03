import { BadRequestException } from '@nestjs/common';

// Assumed defaults: verify against GEN-08 in the requirements sheet
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file?: {
  mimetype: string;
  size: number;
}): void {
  if (!file) {
    throw new BadRequestException('No image file provided');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new BadRequestException(
      `Image too large. Max size: ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB`,
    );
  }
}