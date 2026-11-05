import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { seedAdmin } from './seed-admin';

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
  } finally {
    await app.close();
  }
}
void run();