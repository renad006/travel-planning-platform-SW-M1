import { PassengerType } from './schemas/flight-booking.enums';

/**
 * Pure business rules of flight bookings (no database, no Nest). Keeping them here makes
 * them easy to unit-test and easy to explain.
 */

/** FLT-22: how long seats are held while the user pays. */
export const HOLD_MINUTES = 10;

/** FLT-12b: infants pay 10% of the cabin fare. */
export const INFANT_FARE_RATE = 0.1;

/** PAY-04: one platform currency for every price, payment and refund. */
export const PLATFORM_CURRENCY = 'USD';

/** Matches the caps of the flight search (max 9 adults / 9 children / 9 infants). */
export const MAX_PASSENGERS_PER_TYPE = 9;

// ---------------------------------------------------------------------------
// Money: all arithmetic is done in integer cents so totals never drift (0.1 + 0.2 problem)
// ---------------------------------------------------------------------------

export const toCents = (amount: number): number => Math.round(amount * 100);
export const fromCents = (cents: number): number => cents / 100;

/** FLT-12b: adults and children pay the full fare, infants pay 10%. */
export function fareCentsFor(
  type: PassengerType,
  cabinFareCents: number,
): number {
  return type === PassengerType.INFANT
    ? Math.round(cabinFareCents * INFANT_FARE_RATE)
    : cabinFareCents;
}

/** FLT-19: extra bags cost `extraBagPrice` each. */
export function baggageFeeCents(
  extraBags: number,
  extraBagPrice: number,
): number {
  return extraBags * toCents(extraBagPrice);
}

// ---------------------------------------------------------------------------
// Passenger types (FLT-12b)
// ---------------------------------------------------------------------------

/**
 * Whole years of age on `refDate` ('YYYY-MM-DD', normally the departure date in the origin
 * airport's local time). The date of birth is read as a UTC date, so there are no time-zone
 * surprises around midnight.
 */
export function ageOnDate(dateOfBirth: Date, refDate: string): number {
  const [year, month, day] = refDate.split('-').map(Number);
  let age = year - dateOfBirth.getUTCFullYear();
  const monthDiff = month - (dateOfBirth.getUTCMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && day < dateOfBirth.getUTCDate()))
    age -= 1;
  return age;
}

/** FLT-12b: adult 12+, child 2-11, infant under 2. */
export function passengerTypeForAge(age: number): PassengerType {
  if (age < 2) return PassengerType.INFANT;
  if (age < 12) return PassengerType.CHILD;
  return PassengerType.ADULT;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Lists show only the last 4 characters of a passport number. */
export function maskPassport(passportNumber: string): string {
  if (passportNumber.length <= 4) return '****';
  return `${'*'.repeat(passportNumber.length - 4)}${passportNumber.slice(-4)}`;
}
