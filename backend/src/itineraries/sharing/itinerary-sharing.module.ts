import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from '../schemas/itinerary.schema';
import { ItinerarySharingController } from './itinerary-sharing.controller';
import { ItinerarySharingService } from './itinerary-sharing.service';

/**
 * Member 3: ITN-20 and ITN-21. Lives next to Member 6's itineraries code but is a separate
 * module: it uses her Itinerary model and does not change any of her files.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }])],
  controllers: [ItinerarySharingController],
  providers: [ItinerarySharingService],
})
export class ItinerarySharingModule {}
