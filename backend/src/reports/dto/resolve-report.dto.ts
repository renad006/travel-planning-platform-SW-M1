import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReportAction {
  DISMISS = 'dismiss',
  HIDE = 'hide',
  DELETE = 'delete',
}

export class ResolveReportDto {
  @ApiProperty({ enum: ReportAction })
  @IsEnum(ReportAction)
  action: ReportAction;

  @ApiProperty({ required: false, example: 'Content removed for violating guidelines' })
  @IsOptional()
  @IsString()
  note?: string;
}