import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { SegmentDirection } from '../../schemas/flight-booking.enums';

/** FLT-27: which flight of the booking to change, and optionally the wanted date. */
export class ChangeOptionsQueryDto {
  @ApiPropertyOptional({ enum: SegmentDirection, default: SegmentDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(SegmentDirection)
  segment?: SegmentDirection;

  @ApiPropertyOptional({
    example: '2026-12-12',
    description:
      'Wanted departure date (YYYY-MM-DD, local date at the departure airport). ' +
      'Without it, the flights of the next 30 days are listed.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
