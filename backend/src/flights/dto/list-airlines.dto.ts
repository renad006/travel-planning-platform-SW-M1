import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/** Extra (not in the sheet): list active airlines for the search filter and admin forms. */
export class ListAirlinesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'egypt', description: 'Matches name or code' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}