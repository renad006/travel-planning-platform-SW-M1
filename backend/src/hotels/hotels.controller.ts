import { Body, Controller, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelsService } from './hotels.service';
import { ProviderScope } from '../common/decorators/provider-scope.decorator';
import { ProviderType } from '../common/enums/provider-type.enum';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';

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
}