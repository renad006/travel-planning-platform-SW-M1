import { Body, Controller, NotFoundException, Param, Patch, Post, Delete, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelsService } from './hotels.service';
import { ProviderScope } from '../common/decorators/provider-scope.decorator';
import { ProviderType } from '../common/enums/provider-type.enum';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomStatusQueryDto } from './dto/room-status-query.dto';
import { SearchHotelsQueryDto } from './dto/search-hotels-query.dto';
import { RoomsAvailableQueryDto } from './dto/rooms-available-query.dto';
import { HotelDetailsQueryDto } from './dto/hotel-details-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Hotels')
@ApiCookieAuth()
@Controller('hotels')
export class HotelsController {
    constructor(private readonly hotelsService: HotelsService) {}

    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create a hotel profile (HTL-01)' })
    create(@Body() dto: CreateHotelDto) {
        return this.hotelsService.create(dto);
    }

    @Patch(':id')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Edit my hotel profile (HTL-01)' })
    async update(@Param('id') id: string, @Body() dto: UpdateHotelDto) {
        const hotel = await this.hotelsService.update(id, dto);
        if (!hotel) {
            throw new NotFoundException('Hotel not found');
        }
        return hotel;
    }

    @Post(':id/rooms')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Add a room to my hotel (HTL-03)' })
    createRoom(@Param('id') id: string, @Body() dto: CreateRoomDto) {
        return this.hotelsService.createRoom(id, dto);
    }

    @Post(':id/rooms/:roomId/availability')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Add a bookable date range to a room (HTL-04)' })
    addAvailability(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Body() dto: CreateAvailabilityDto,
    ) {
        return this.hotelsService.addAvailability(id, roomId, dto);
    }

    @Patch(':id/rooms/:roomId')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Edit a room beds, occupancy and price (HTL-05)' })
    updateRoom(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Body() dto: UpdateRoomDto,
    ) {
        return this.hotelsService.updateRoom(id, roomId, dto);
    }

    @Patch(':id/rooms/:roomId/availability/:availabilityId')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Edit a bookable date range of a room (HTL-05)' })
    updateAvailability(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Param('availabilityId') availabilityId: string,
        @Body() dto: CreateAvailabilityDto,
    ) {
        return this.hotelsService.updateAvailability(id, roomId, availabilityId, dto);
    }

    @Post(':id/rooms/:roomId/blocks')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Block a date range for a room (HTL-06)' })
    blockRoom(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Body() dto: CreateAvailabilityDto,
    ) {
        return this.hotelsService.blockRoom(id, roomId, dto);
    }

    @Patch(':id/rooms/:roomId/deactivate')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Deactivate a room (HTL-06)' })
    deactivateRoom(@Param('id') id: string, @Param('roomId') roomId: string) {
        return this.hotelsService.deactivateRoom(id, roomId);
    }

    @Delete(':id/rooms/:roomId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Delete a never-reserved room (HTL-06)' })
    deleteRoom(@Param('id') id: string, @Param('roomId') roomId: string) {
        return this.hotelsService.deleteRoom(id, roomId);
    }

    @Get('search')
    @Public()
    @ApiOperation({ summary: 'Search hotels with free rooms (HTL-11)' })
    search(@Query() query: SearchHotelsQueryDto) {
        return this.hotelsService.search(query);
    }

    @Get(':id/rooms/available')
    @Public()
    @ApiOperation({ summary: 'List free rooms for a stay (HTL-15)' })
    availableRooms(
        @Param('id') id: string,
        @Query() query: RoomsAvailableQueryDto,
    ) {
        return this.hotelsService.availableRooms(id, query);
    }

    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Hotel details, with free rooms if dates are given (HTL-02)' })
    details(@Param('id') id: string, @Query() query: HotelDetailsQueryDto) {
        return this.hotelsService.details(id, query);
    }

    @Get(':id/reservations')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'Reservations of my hotel (HTL-22)' })
    reservations(@Param('id') id: string, @Query() query: PaginationQueryDto) {
        return this.hotelsService.reservations(id, query);
    }

    @Get(':id/availability')
    @ProviderScope(ProviderType.HOTEL)
    @ApiOperation({ summary: 'View room status for a date range (HTL-08)' })
    roomStatuses(@Param('id') id: string, @Query() query: RoomStatusQueryDto) {
        return this.hotelsService.roomStatuses(id, query);
    }
}