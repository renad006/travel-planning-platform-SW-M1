import { PartialType } from '@nestjs/swagger';
import { CreateHotelDto } from './create-hotel.dto';

// HTL-01: a moderator edits any of the profile fields
export class UpdateHotelDto extends PartialType(CreateHotelDto) {}