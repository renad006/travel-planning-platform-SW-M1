import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { FlightBookingsReader } from './flight-bookings.reader';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Airline, AirlineSchema } from './schemas/airline.schema';
import { Flight, FlightSchema } from './schemas/flight.schema'; // <--- ADDED THIS LINE BACK
import { CabinInventory, CabinInventorySchema } from './schemas/cabin-inventory.schema';

@Module({
  imports: [
    // The Airport model comes from Member 1's (global) ReferenceDataModule
    EventEmitterModule.forRoot(), // Use .forRoot() so the EventEmitter is available globally
    ReferenceDataModule,
   
    MongooseModule.forFeature([
      { name: Airline.name, schema: AirlineSchema },
      { name: Flight.name, schema: FlightSchema },
      { name: CabinInventory.name, schema: CabinInventorySchema },
    ]),
  ],
  controllers: [FlightsController],
  providers: [FlightsService, FlightBookingsReader],
  // Member 3 / 5 / 6 use FlightsService (seat helpers, refund %, search) and the models
  exports: [FlightsService, MongooseModule],
})
export class FlightsModule {}