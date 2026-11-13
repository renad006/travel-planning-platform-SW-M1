import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'GEN-07: filter by actor (user id)' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({
    example: 'ACCOUNT_SUSPENDED',
    description: 'GEN-07: filter by action',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    example: 'user',
    description: 'GEN-07: filter by target type',
  })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'GEN-07: filter by target id' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'GEN-07: logs from this date (ISO 8601, inclusive)',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'GEN-07: logs up to this date (ISO 8601, inclusive)',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}