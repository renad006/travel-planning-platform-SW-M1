import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';

// ITN-27: link one of my confirmed bookings to an itinerary day
export class LinkBookingDto {
  @ApiProperty({ enum: ['hotel', 'flight'], example: 'hotel' })
  @IsIn(['hotel', 'flight'], { message: 'type must be hotel or flight' })
  type: 'hotel' | 'flight';

  @ApiProperty({ example: '6af8382b81f6d541bbcf5382', description: 'Id of my hotel or flight reservation' })
  @IsMongoId()
  bookingId: string;
}