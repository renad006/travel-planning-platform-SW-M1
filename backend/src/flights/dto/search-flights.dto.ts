import { IsString, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchFlightsDto {
  @ApiProperty({ example: 'CAI' })
  @IsString()
  origin: string;

  @ApiProperty({ example: 'DXB' })
  @IsString()
  destination: string;

  @ApiProperty({ example: '2026-12-20' })
  @IsDateString()
  departureDate: string;

  @ApiPropertyOptional({ example: '2026-12-25' })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  adults?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  children?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  infants?: number;

  @ApiPropertyOptional({ example: 'Economy', enum: ['Economy', 'Business'] })
  @IsOptional()
  @IsEnum(['Economy', 'Business'])
  cabinClass?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ example: '6a6fc29e5ec1356c91724bab' })
  @IsOptional()
  @IsString()
  airlineId?: string;

  @ApiPropertyOptional({ example: 'price', enum: ['price', 'duration', 'departureTime'] })
  @IsOptional()
  @IsString()
  sortBy?: string;

  // --- PAGINATION FIELDS (Must be inside the class!) ---
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Results per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}