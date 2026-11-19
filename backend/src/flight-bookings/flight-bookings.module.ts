import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightsModule } from '../flights/flights.module';
import { PAYABLE_FLIGHT_BOOKINGS } from '../payments/payable-booking.interface';
import { FlightChangesController } from './changes/flight-changes.controller';
import { FlightChangesService } from './changes/flight-changes.service';
import { PAYABLE_FLIGHT_CHANGES } from './changes/payable-change.interface';
import { FlightBookingsController } from './flight-bookings.controller';
import { FlightBookingsListener } from './flight-bookings.listener';
import { FlightBookingsService } from './flight-bookings.service';
import { FlightBookingsTasks } from './flight-bookings.tasks';
import { FlightSeatsController } from './seats/flight-seats.controller';
import { FlightSeatsService } from './seats/flight-seats.service';
import { SeatAssignment, SeatAssignmentSchema } from './seats/schemas/seat-assignment.schema';
import {
  FlightBooking,
  FlightBookingSchema,
} from './schemas/flight-booking.schema';

/**
 * Member 3: flight bookings (FLT-19 to FLT-26), seat selection (FLT-28, bonus) and changing a
 * flight (FLT-27, bonus).
 *
 * FlightsModule (Member 2) provides the seat inventory API and exports the Flight / Airline /
 * CabinInventory models. NotificationsModule and ReferenceDataModule (Member 1) are global.
 *
 * Exports the PAYABLE_FLIGHT_BOOKINGS token: the booking contract Member 5's payments module uses
 * (findPayable, confirmAfterPayment, expireHold, markPoliciesAccepted), and FlightBookingsService
 * (hasUpcomingConfirmedBookings for Member 1, ACC-12).
 * PAYABLE_FLIGHT_CHANGES (changes/payable-change.interface.ts) is the contract for paying the price
 * difference of a change to a dearer flight (FLT-27).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: SeatAssignment.name, schema: SeatAssignmentSchema }, // FLT-28
    ]),
    FlightsModule,
  ],
  controllers: [FlightBookingsController, FlightSeatsController, FlightChangesController],
  providers: [
    FlightBookingsService,
    FlightBookingsTasks,
    { provide: PAYABLE_FLIGHT_BOOKINGS, useExisting: FlightBookingsService },
    FlightBookingsListener,
    FlightSeatsService, // FLT-28
    FlightChangesService, // FLT-27
    { provide: PAYABLE_FLIGHT_CHANGES, useExisting: FlightChangesService }, // FLT-27: for Payments
  ],
  exports: [FlightBookingsService, PAYABLE_FLIGHT_BOOKINGS, PAYABLE_FLIGHT_CHANGES, MongooseModule],
})
export class FlightBookingsModule {}
