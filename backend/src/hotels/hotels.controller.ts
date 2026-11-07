import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelsService } from './hotels.service';

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
}