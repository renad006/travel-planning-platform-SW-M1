import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class AdminAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start of the period (ISO date), inclusive' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of the period (ISO date), inclusive' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}