import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { SegmentDirection } from '../../schemas/flight-booking.enums';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Which flight of the booking: the outbound one (default) or the return one of a round trip. */
export class SeatSegmentQueryDto {
  @ApiPropertyOptional({ enum: SegmentDirection, default: SegmentDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(SegmentDirection)
  segment?: SegmentDirection;
}

export class SelectSeatDto extends SeatSegmentQueryDto {
  @ApiProperty({ example: 0, description: 'Position of the passenger in the booking, starting at 0' })
  @IsInt()
  @Min(0)
  passengerIndex: number;

  @ApiProperty({ example: '30C', description: 'Row number and letter, from the seat map' })
  @Transform(upper)
  @Matches(/^[0-9]{1,3}[A-Z]$/, { message: 'seat must look like 30C' })
  seat: string;
}
