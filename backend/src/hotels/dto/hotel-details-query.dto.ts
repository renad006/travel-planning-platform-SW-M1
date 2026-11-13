import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// HTL-02: dates are optional, give both to also get the free rooms
export class HotelDetailsQueryDto {
  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2026-12-05' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;
}
