import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlightBookingsService } from './flight-bookings.service';

/**
 * Background jobs of the booking lifecycle (GEN-11).
 * Needs ScheduleModule.forRoot(): Member 2's FlightsModule already registers it (do not add it again).
 * Every job is safe to run on several instances at once: the service uses atomic claims.
 */
@Injectable()
export class FlightBookingsTasks {
  private readonly logger = new Logger(FlightBookingsTasks.name);
  private expiring = false;

  /** FLT-22: Pending Payment holds older than 10 minutes become Expired, seats are released. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds(): Promise<void> {
    if (this.expiring) return; // never overlap with a previous run
    this.expiring = true;
    try {
      const count = await this.service.expireDueHolds();
      if (count > 0) this.logger.log(`Expired ${count} flight seat hold(s)`);
    } catch (error) {
      this.logger.error(`Hold expiry job failed: ${(error as Error).message}`);
    } finally {
      this.expiring = false;
    }
  }

  constructor(private readonly service: FlightBookingsService) {}
}
