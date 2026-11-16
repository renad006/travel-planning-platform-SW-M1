import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FLIGHT_EVENTS } from '../flights/flight.events';
import type {
  FlightCancelledEvent,
  FlightScheduleChangedEvent,
} from '../flights/flight.events';
import { FlightBookingsService } from './flight-bookings.service';

/** Member 2's flights module announces changes; this module reacts to them (FLT-05, FLT-06). */
@Injectable()
export class FlightBookingsListener {
  private readonly logger = new Logger(FlightBookingsListener.name);

  constructor(private readonly service: FlightBookingsService) {}

  @OnEvent(FLIGHT_EVENTS.CANCELLED)
  async onFlightCancelled(event: FlightCancelledEvent): Promise<void> {
    try {
      await this.service.handleFlightCancelled(
        event.flightId,
        event.flightNumber,
      );
    } catch (error) {
      this.logger.error(
        `Handling cancelled flight ${event.flightNumber} failed: ${(error as Error).message}`,
      );
    }
  }

  @OnEvent(FLIGHT_EVENTS.SCHEDULE_CHANGED)
  async onScheduleChanged(event: FlightScheduleChangedEvent): Promise<void> {
    try {
      await this.service.handleScheduleChanged(event);
    } catch (error) {
      this.logger.error(
        `Handling schedule change of ${event.flightNumber} failed: ${(error as Error).message}`,
      );
    }
  }
}
