import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from '../schemas/itinerary.schema';
import { ItineraryBudgetController } from './itinerary-budget.controller';
import { ItineraryBudgetService } from './itinerary-budget.service';

/**
 * Member 3: ITN-14 and ITN-16. Lives next to Member 6's itineraries code but is a separate
 * module: it uses her Itinerary model and does not change any of her files.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }])],
  controllers: [ItineraryBudgetController],
  providers: [ItineraryBudgetService],
})
export class ItineraryBudgetModule {}
