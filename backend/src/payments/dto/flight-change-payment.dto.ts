import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

// FLT-27: pay the price difference of a pending flight change
export class FlightChangePaymentDto {
  @ApiProperty({ example: '6af...', description: 'The flight booking id' })
  @IsMongoId()
  bookingId: string;

  @ApiProperty({ example: '6af...', description: 'Id of the pending change on that booking' })
  @IsMongoId()
  changeId: string;
}