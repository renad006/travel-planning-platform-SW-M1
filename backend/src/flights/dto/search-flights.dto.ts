import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';
import { CabinClass } from '../schemas/cabin-inventory.schema';
import { PaginationDto } from './pagination.dto';

export enum FlightSortBy {
  PRICE = 'price',
  DURATION = 'duration',
  DEPARTURE_TIME = 'departureTime',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** FLT-11, FLT-12, FLT-15 */
export class SearchFlightsDto extends PaginationDto {
  @ApiProperty({ example: 'CAI' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter IATA code' })
  origin: string;

  @ApiProperty({ example: 'DXB' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'destination must be a 3-letter IATA code' })
  destination: string;

  @ApiProperty({ example: '2026-12-20', description: 'Local date at the departure airport' })
  @Matches(DATE, { message: 'departureDate must be YYYY-MM-DD' })
  departureDate: string;

  @ApiPropertyOptional({ example: '2026-12-25', description: 'Set for a round-trip search' })
  @IsOptional()
  @Matches(DATE, { message: 'returnDate must be YYYY-MM-DD' })
  returnDate?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Age 12+, at least 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Age 2-11' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9)
  children?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Under 2, no seat, max one per adult' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9)
  infants?: number;

  @ApiPropertyOptional({ enum: CabinClass, description: 'Optional filter (FLT-12c)' })
  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;

  @ApiPropertyOptional({ example: 100, description: 'Inclusive minimum fare per adult/child' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500, description: 'Inclusive maximum fare per adult/child' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: '6a6fc29e5ec1356c91724bab' })
  @IsOptional()
  @IsMongoId()
  airlineId?: string;

  @ApiPropertyOptional({ enum: FlightSortBy, default: FlightSortBy.DEPARTURE_TIME })
  @IsOptional()
  @IsEnum(FlightSortBy)
  sortBy?: FlightSortBy;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
