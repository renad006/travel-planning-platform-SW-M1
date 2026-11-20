import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { Airport } from '../reference-data/schemas/airport.schema';
import { Country } from '../reference-data/schemas/country.schema';
import { City } from '../reference-data/schemas/city.schema';
import { Attraction } from '../reference-data/schemas/attraction.schema';
import { UsersService } from '../users/users.service';
import { seedAdmin } from './seed-admin';
import { seedAirports } from './seed-airports';
import { seedCountries, seedCities, seedAttractions } from './seed-reference';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    await seedAdmin(
      app.get(UsersService),
      process.env.ADMIN_EMAIL,
      process.env.ADMIN_PASSWORD,
    );
    await seedCountries(app.get(getModelToken(Country.name)));
    await seedCities(app.get(getModelToken(City.name)));
    await seedAttractions(app.get(getModelToken(Attraction.name)));
    await seedAirports(app.get(getModelToken(Airport.name)));
  } finally {
    await app.close();
  }
}
void run();