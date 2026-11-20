import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { SegmentDirection } from '../../schemas/flight-booking.enums';

/** FLT-27: which flight of the booking changes, and to which flight. */
export class ChangeFlightDto {
  @ApiPropertyOptional({
    enum: SegmentDirection,
    default: SegmentDirection.OUTBOUND,
    description: 'The flight to change: outbound (default) or return (round trips only)',
  })
  @IsOptional()
  @IsEnum(SegmentDirection)
  segment?: SegmentDirection;

  @ApiProperty({
    example: '665f1c2e8a1b2c3d4e5f6a7b',
    description: 'The new flight: take its flightId from GET /:id/change-options',
  })
  @IsMongoId()
  flightId: string;
}
