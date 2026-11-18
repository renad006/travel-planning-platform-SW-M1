import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AttachItineraryDto {
  @ApiProperty({ description: 'The ID of the itinerary to attach' })
  @IsMongoId()
  itineraryId: string;
}