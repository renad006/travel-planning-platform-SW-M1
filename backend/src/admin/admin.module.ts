import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightBooking, FlightBookingSchema } from '../flight-bookings/schemas/flight-booking.schema';
import { Airline, AirlineSchema } from '../flights/schemas/airline.schema';
import { HotelBooking, HotelBookingSchema } from '../hotel-bookings/schemas/hotel-booking.schema';
import { Hotel, HotelSchema } from '../hotels/schemas/hotel.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { AdminService } from './admin.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Airline.name, schema: AirlineSchema },
      { name: Hotel.name, schema: HotelSchema },
      { name: User.name, schema: UserSchema },
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: HotelBooking.name, schema: HotelBookingSchema },
    ]),
  ],
  controllers: [AdminController, AdminManagementController],
  providers: [AdminService, AdminManagementService],
})
export class AdminModule {}