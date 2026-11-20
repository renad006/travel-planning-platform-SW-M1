import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

// HTL-15: the stay the guest wants. checkOut is the checkout day.
export class RoomsAvailableQueryDto {
  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-12-05' })
  @IsDateString()
  checkOut: string;
}
