import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FxRatesController } from './fx-rates.controller';
import { FxRatesService } from './fx-rates.service';
import { FxRateSnapshot, FxRateSnapshotSchema } from './schemas/fx-rate-snapshot.schema';

/**
 * Member 3: ITN-18 exchange rates. Needs ScheduleModule.forRoot(), which Member 2's FlightsModule
 * already registers (do not add it again). Exported so the itinerary budget summary can convert.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: FxRateSnapshot.name, schema: FxRateSnapshotSchema }])],
  controllers: [FxRatesController],
  providers: [FxRatesService],
  exports: [FxRatesService],
})
export class FxRatesModule {}
