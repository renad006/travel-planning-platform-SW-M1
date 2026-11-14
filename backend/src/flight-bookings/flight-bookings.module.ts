import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightsModule } from '../flights/flights.module';
import { PAYABLE_FLIGHT_BOOKINGS } from '../payments/payable-booking.interface';
import { FlightBookingsController } from './flight-bookings.controller';
import { FlightBookingsService } from './flight-bookings.service';
import { FlightBookingsTasks } from './flight-bookings.tasks';
import {
  FlightBooking,
  FlightBookingSchema,
} from './schemas/flight-booking.schema';

/**
 * Member 3: flight bookings (FLT-19 to FLT-26).
 *
 * FlightsModule (Member 2) provides the seat inventory API and exports the Flight / Airline /
 * CabinInventory models. NotificationsModule and ReferenceDataModule (Member 1) are global.
 *
 * Exports the PAYABLE_FLIGHT_BOOKINGS token: the booking contract Member 5's payments module uses
 * (findPayable, confirmAfterPayment, expireHold, markPoliciesAccepted), and FlightBookingsService
 * (hasUpcomingConfirmedBookings for Member 1, ACC-12).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlightBooking.name, schema: FlightBookingSchema },
    ]),
    FlightsModule,
  ],
  controllers: [FlightBookingsController],
  providers: [
    FlightBookingsService,
    FlightBookingsTasks,
    { provide: PAYABLE_FLIGHT_BOOKINGS, useExisting: FlightBookingsService },
  ],
  exports: [FlightBookingsService, PAYABLE_FLIGHT_BOOKINGS, MongooseModule],
})
export class FlightBookingsModule {}
