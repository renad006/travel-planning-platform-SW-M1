/**
 * Events emitted by the flights module. Member 3 (bookings) listens with @OnEvent(...)
 * and handles bookings, refunds (PAY-03) and in-app notifications (GEN-01).
 */
export const FLIGHT_EVENTS = {
  /** FLT-06: moderator cancelled a Scheduled flight. */
  CANCELLED: 'flight.cancelled',
  /** FLT-05: departure and/or arrival time changed. */
  SCHEDULE_CHANGED: 'flight.schedule-changed',
  /** FLT-30: flights whose departure time passed were marked Departed. */
  DEPARTED: 'flight.departed',
} as const;

export interface FlightCancelledEvent {
  flightId: string;
  flightNumber: string;
}

export interface FlightScheduleChangedEvent {
  flightId: string;
  flightNumber: string;
  oldDepartureTime: Date;
  oldArrivalTime: Date;
  newDepartureTime: Date;
  newArrivalTime: Date;
}

export interface FlightDepartedEvent {
  flightIds: string[];
}