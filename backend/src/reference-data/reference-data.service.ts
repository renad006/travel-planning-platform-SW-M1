import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from './schemas/city.schema';
import { Country, CountryDocument } from './schemas/country.schema';

@Injectable()
export class ReferenceDataService {
  constructor(
    @InjectModel(Country.name)
    private readonly countryModel: Model<CountryDocument>,
    @InjectModel(City.name) private readonly cityModel: Model<CityDocument>,
  ) {}

  findCountries() {
    return this.countryModel
      .find()
      .sort({ name: 1 })
      .select('-_id -__v')
      .lean();
  }

  findCities(countryCode?: string) {
    const filter = countryCode ? { countryCode } : {};
    return this.cityModel
      .find(filter)
      .sort({ name: 1 })
      .select('-_id -__v')
      .lean();
  }
}