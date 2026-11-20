import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { ReportTargetType } from '../schemas/report.schema';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiProperty({ description: 'The ID of the post/comment/review/itinerary' })
  @IsMongoId()
  targetId: string;

  @ApiProperty({ example: 'Inappropriate language' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}