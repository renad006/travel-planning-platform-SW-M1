import { PartialType, PickType } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';

// HTL-05: only beds, occupancy and price can be edited
export class UpdateRoomDto extends PartialType(
    PickType(CreateRoomDto, ['beds', 'maxOccupancy', 'pricePerNight'] as const),
) {}