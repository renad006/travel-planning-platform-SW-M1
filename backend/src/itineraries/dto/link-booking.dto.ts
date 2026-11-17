import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';

// ITN-27: link one of my confirmed bookings to an itinerary day
export class LinkBookingDto {
  @ApiProperty({ enum: ['hotel'], example: 'hotel' })
  @IsIn(['hotel'], { message: 'type must be hotel' })
  type: 'hotel';

  @ApiProperty({ example: '6af8382b81f6d541bbcf5382', description: 'Id of my hotel reservation' })
  @IsMongoId()
  bookingId: string;
}
