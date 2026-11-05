import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Airport, AirportSchema } from './schemas/airport.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Airport.name, schema: AirportSchema }]),
  ],
  exports: [MongooseModule],
})
export class ReferenceDataModule {}