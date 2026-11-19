import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ListFavouritesDto } from './dto/list-favourites.dto';
import { FavouritesService } from './favourites.service';

@ApiTags('Favourites')
@ApiCookieAuth()
@Roles(Role.USER)
@Controller('favourites')
export class FavouritesController {
    constructor(private readonly favouritesService: FavouritesService) {}

    @Post()
    @ApiOperation({ summary: 'Save a hotel or a public itinerary to my favourites (BON-02)' })
    add(@CurrentUser() user: UserDocument, @Body() dto: AddFavouriteDto) {
        return this.favouritesService.add(user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'View my favourites, newest first, optionally only hotels or itineraries (BON-02)' })
    list(@CurrentUser() user: UserDocument, @Query() query: ListFavouritesDto) {
        return this.favouritesService.list(user.id, query);
    }

    @Delete(':id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Remove one of my favourites by its favouriteId (BON-02)' })
    remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
        return this.favouritesService.remove(user.id, id);
    }
}
