import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// HTL-11: search by city or country, dates, guests and rooms.
// checkOut is the checkout day, same rule as room availability.
export class SearchHotelsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'CAI', description: 'City identifier' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ example: 'EG', description: 'Country code' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  countryCode?: string;

  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-12-05' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests: number;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rooms: number = 1;
}
