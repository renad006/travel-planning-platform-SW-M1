import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';

@Module({
  providers: [UploadsService],
  exports: [UploadsService], // Export so other modules can use it
})
export class UploadsModule {}