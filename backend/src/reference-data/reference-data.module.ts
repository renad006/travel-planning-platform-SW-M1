import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenceDataController } from './reference-data.controller';
import { ReferenceDataService } from './reference-data.service';
import { Airport, AirportSchema } from './schemas/airport.schema';
import { Country, CountrySchema } from './schemas/country.schema';
import { City, CitySchema } from './schemas/city.schema';
import { Attraction, AttractionSchema } from './schemas/attraction.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Airport.name, schema: AirportSchema },
      { name: Country.name, schema: CountrySchema },
      { name: City.name, schema: CitySchema },
      { name: Attraction.name, schema: AttractionSchema },
    ]),
  ],
  controllers: [ReferenceDataController],
  providers: [ReferenceDataService],
  exports: [MongooseModule, ReferenceDataService],
})
export class ReferenceDataModule {}