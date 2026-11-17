import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class GetPostsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'travel', description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: 'Paris', description: 'Search by keyword' })
  @IsOptional()
  @IsString()
  q?: string;
}