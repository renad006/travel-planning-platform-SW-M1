import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { FlightsModule } from '../flights/flights.module';
import { HotelsModule } from '../hotels/hotels.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { ItineraryBudgetModule } from './budget/itinerary-budget.module';
import { City, CitySchema } from '../reference-data/schemas/city.schema';
import { Airport, AirportSchema } from '../reference-data/schemas/airport.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Itinerary.name, schema: ItinerarySchema },
      { name: City.name, schema: CitySchema },
      { name: Airport.name, schema: AirportSchema },
    ]),
    FlightsModule,
    HotelsModule,
    HotelBookingsModule,
    FlightBookingsModule,
    ItineraryBudgetModule,
  ],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}