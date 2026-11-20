import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import { FAVOURITE_TYPES, type FavouriteType } from '../schemas/favourite.schema';

export class AddFavouriteDto {
    @ApiProperty({ enum: FAVOURITE_TYPES, example: 'hotel' })
    @IsIn(FAVOURITE_TYPES, { message: 'type must be hotel or itinerary' })
    type: FavouriteType;

    @ApiProperty({ example: '6af5d8cc1129cc40f15eb884', description: 'Id of the hotel or of the public itinerary' })
    @IsMongoId()
    targetId: string;
}
