import { PartialType } from '@nestjs/swagger';
import { CreateItineraryDto } from './create-itinerary.dto';
export class UpdateItineraryDto extends PartialType(CreateItineraryDto) {}