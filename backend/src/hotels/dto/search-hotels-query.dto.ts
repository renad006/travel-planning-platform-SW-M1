import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
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

  // HTL-12: inclusive price range on the cheapest qualifying room per night
  @ApiPropertyOptional({ example: 50, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 300, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  // unrated hotels are excluded when this is set
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    enum: ['price', 'rating'],
    example: 'price', // replaces the example inherited from PaginationQueryDto
    description: 'Omit to sort by hotel name',
  })
  @IsOptional()
  @IsIn(['price', 'rating'])
  sortBy?: 'price' | 'rating' = undefined;

  // overrides the shared default (desc) so price sorts cheapest first
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
