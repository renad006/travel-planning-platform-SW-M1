import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import {
  FlightBooking,
  FlightBookingSchema,
} from '../flight-bookings/schemas/flight-booking.schema';
import { FlightBookingsReader } from './flight-bookings.reader';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Airline, AirlineSchema } from './schemas/airline.schema';
import { CabinInventory, CabinInventorySchema } from './schemas/cabin-inventory.schema';
import { Flight, FlightSchema } from './schemas/flight.schema';

@Module({
  imports: [
    // These two are @Global() in Nest: calling .forRoot() ONCE, from ANY module that is
    // itself imported into AppModule, makes EventEmitter2 and @Cron available app-wide.
    // Other members do NOT need to call .forRoot() again in their own modules - they can
    // just inject EventEmitter2 / use @OnEvent / @Cron directly.
    // IMPORTANT: if a teammate (e.g. Notifications) ALSO calls one of these .forRoot()s
    // somewhere else, remove the duplicate - registering either one twice in the same
    // app causes two separate instances, and events/cron jobs silently stop reaching
    // each other. Confirm with the team before merging.
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    // The Airport model comes from Member 1's ReferenceDataModule
    ReferenceDataModule,
    MongooseModule.forFeature([
      { name: Airline.name, schema: AirlineSchema },
      { name: Flight.name, schema: FlightSchema },
      { name: CabinInventory.name, schema: CabinInventorySchema },
      // Registering Member 3's FlightBooking model here too (read-only, for FLT-29)
      // is safe: Mongoose keys compiled models by name+connection, so this doesn't
      // conflict with their own module also registering it.
      { name: FlightBooking.name, schema: FlightBookingSchema },
    ]),
  ],
  controllers: [FlightsController],
  providers: [FlightsService, FlightBookingsReader],
  // Member 3 / 5 / 6 use FlightsService (seat helpers, refund %, search) and the models
  exports: [FlightsService, MongooseModule],
})
export class FlightsModule {}