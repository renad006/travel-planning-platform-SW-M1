import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

/** FLT-05 (seats, price) + correcting the FLT-04 baggage allowance. Send at least one field. */
export class UpdateCabinDto {
  @ApiPropertyOptional({ example: 180, description: 'New total seats (whole number > 0, not below held + booked)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @ApiPropertyOptional({ example: 300, description: 'New fare (> 0). Existing bookings keep their price.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ example: 1, description: 'Free bags per passenger (>= 0)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  freeBags?: number;

  @ApiPropertyOptional({ example: 23, description: 'Max weight per bag in kg (> 0)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maxWeightKg?: number;
}
