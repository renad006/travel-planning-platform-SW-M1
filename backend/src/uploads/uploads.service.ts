import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  async saveFile(
    file: Express.Multer.File,
    folder: 'posts' | 'activities' | 'hotels' | 'airlines',
  ) {
    if (!file) throw new BadRequestException('No file provided');
    
    // 1. Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 5MB)');
    }

    // 2. Validate magic bytes (simple check for JPG/PNG)
    const isJpg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8;
    const isPng = file.buffer[0] === 0x89 && file.buffer[1] === 0x50;
    if (!isJpg && !isPng) {
      throw new BadRequestException('Only JPG and PNG files are allowed');
    }

    // 3. Save file
    const filename = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const dir = join(process.cwd(), 'uploads', folder);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    // Write file to disk
    await fs.writeFile(join(dir, filename), file.buffer);

    return {
      id: randomUUID(),
      url: `/uploads/${folder}/${filename}`,
      filename,
    };
  }

  async deleteFile(folder: string, filename: string) {
    try {
      const filePath = join(process.cwd(), 'uploads', folder, filename);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file not found
    }
  }
}