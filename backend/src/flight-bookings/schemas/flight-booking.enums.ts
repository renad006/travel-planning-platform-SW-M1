/**
 * Enums of the flight booking. Kept in their own dependency-free file so the pure business
 * rules (and their unit tests) can use them without loading Mongoose or Nest.
 */

/** FLT-12a: a round trip is ONE booking with two segments. */
export enum TripType {
  ONE_WAY = 'one_way',
  ROUND_TRIP = 'round_trip',
}

export enum SegmentDirection {
  OUTBOUND = 'outbound',
  RETURN = 'return',
}

/** FLT-12b: adult 12+, child 2-11, infant <2 (computed from date of birth). */
export enum PassengerType {
  ADULT = 'adult',
  CHILD = 'child',
  INFANT = 'infant',
}

/** Who cancelled: the user (FLT-26) or the airline (FLT-06, always 100% refund). */
export enum CancelledBy {
  USER = 'user',
  AIRLINE = 'airline',
}
