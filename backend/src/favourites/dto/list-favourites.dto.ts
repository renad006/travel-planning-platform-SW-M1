import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FAVOURITE_TYPES, type FavouriteType } from '../schemas/favourite.schema';

export class ListFavouritesDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: FAVOURITE_TYPES, description: 'Only hotels or only itineraries' })
    @IsOptional()
    @IsIn(FAVOURITE_TYPES)
    type?: FavouriteType;
}
