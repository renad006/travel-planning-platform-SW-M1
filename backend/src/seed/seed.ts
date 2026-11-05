import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { Airport } from '../reference-data/schemas/airport.schema';
import { UsersService } from '../users/users.service';
import { seedAdmin } from './seed-admin';
import { seedAirports } from './seed-airports';

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
    await seedAirports(app.get(getModelToken(Airport.name)));
  } finally {
    await app.close();
  }
}
void run();