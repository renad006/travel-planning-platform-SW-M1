import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/** FLT-25: the three groups of "My bookings". */
export enum BookingGroup {
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export class ListFlightBookingsDto {
  @ApiPropertyOptional({
    enum: BookingGroup,
    description:
      'upcoming = confirmed trips not finished yet (+ bookings still awaiting payment); ' +
      'past = completed trips; cancelled = cancelled or expired. Omit for everything.',
  })
  @IsOptional()
  @IsEnum(BookingGroup)
  group?: BookingGroup;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
