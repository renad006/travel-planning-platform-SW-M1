import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/** FLT-02 */
export class ListAirportsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cai', description: 'Matches IATA code or airport name' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @ApiPropertyOptional({ example: 'EG', description: 'Country code' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2,3}$/, { message: 'countryCode must be 2-3 letters' })
  countryCode?: string;

  @ApiPropertyOptional({ description: 'City id exactly as in the seeded data (used by itineraries, ITN-26)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cityId?: string;
}