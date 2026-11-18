import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FxRatesModule } from '../../fx-rates/fx-rates.module';
import { Itinerary, ItinerarySchema } from '../schemas/itinerary.schema';
import { ItineraryBudgetController } from './itinerary-budget.controller';
import { ItineraryBudgetService } from './itinerary-budget.service';

/**
 * Member 3: ITN-14 and ITN-16. Lives next to Member 6's itineraries code but is a separate
 * module: it uses her Itinerary model and does not change any of her files.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }]),
    FxRatesModule, // ITN-18: the budget summary converts with the platform's exchange rates
  ],
  controllers: [ItineraryBudgetController],
  providers: [ItineraryBudgetService],
  // ITN-09: Member 6's ItinerariesService uses the subtotal calculations
  exports: [ItineraryBudgetService],
})
export class ItineraryBudgetModule {}
