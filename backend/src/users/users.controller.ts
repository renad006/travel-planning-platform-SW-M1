import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountStatus } from '../common/enums/account-status.enum';
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly flightBookings: FlightBookingsService,
    private readonly hotelBookings: HotelBookingsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile (ACC-11)' })
  @ApiResponse({ status: 200, description: 'My profile (ACC-11)' })
  @ApiResponse({ status: 401, description: 'Not logged in or session expired' })
  getMe(@CurrentUser() user: UserDocument) {
    return user;
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Edit my name, phone and preferred currency (ACC-09)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated (ACC-09)' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or a disallowed field was sent',
  })
  @ApiResponse({ status: 401, description: 'Not logged in or session expired' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateMe(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateById(user.id, dto);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate my own account (ACC-12)' })
  @ApiResponse({ status: 204, description: 'Account deactivated (ACC-12)' })
  @ApiResponse({
    status: 409,
    description:
      'Deactivation is blocked while an upcoming Confirmed flight or hotel booking exists (ACC-12)',
  })
  @ApiResponse({ status: 401, description: 'Not logged in or session expired' })
  async deactivateMe(@CurrentUser() user: UserDocument): Promise<void> {
    // ACC-12: deactivation is blocked while the user has upcoming Confirmed bookings —
    // previously this was never checked, so an account could deactivate out from under a
    // paid, upcoming trip.
    const [hasFlights, hasHotels] = await Promise.all([
      this.flightBookings.hasUpcomingConfirmedBookings(user.id),
      this.hotelBookings.hasUpcomingConfirmedBookings(user.id),
    ]);
    if (hasFlights || hasHotels) {
      throw new ConflictException(
        'You cannot deactivate your account while you have an upcoming confirmed booking',
      );
    }

    // Access and refresh tokens stop working at once because both check status.
    await this.usersService.updateById(user.id, {
      status: AccountStatus.DEACTIVATED,
    });
  }
}