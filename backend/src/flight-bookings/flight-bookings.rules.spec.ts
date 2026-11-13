import {
  ageOnDate,
  baggageFeeCents,
  fareCentsFor,
  fromCents,
  maskPassport,
  passengerTypeForAge,
  toCents,
} from './flight-bookings.rules';
import { PassengerType } from './schemas/flight-booking.enums';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('passenger age and type (FLT-12b)', () => {
  it('counts whole years, not yet turned on the birthday', () => {
    expect(ageOnDate(utc('2000-12-21'), '2026-12-20')).toBe(25); // birthday is tomorrow
    expect(ageOnDate(utc('2000-12-20'), '2026-12-20')).toBe(26); // birthday is today
    expect(ageOnDate(utc('2000-01-01'), '2026-12-20')).toBe(26);
  });

  it('classifies infant (<2), child (2-11) and adult (12+) at the exact boundaries', () => {
    expect(passengerTypeForAge(0)).toBe(PassengerType.INFANT);
    expect(passengerTypeForAge(1)).toBe(PassengerType.INFANT);
    expect(passengerTypeForAge(2)).toBe(PassengerType.CHILD);
    expect(passengerTypeForAge(11)).toBe(PassengerType.CHILD);
    expect(passengerTypeForAge(12)).toBe(PassengerType.ADULT);
    expect(passengerTypeForAge(60)).toBe(PassengerType.ADULT);
  });

  it('a child who turns 12 the day after departure is still a child', () => {
    expect(
      passengerTypeForAge(ageOnDate(utc('2014-12-21'), '2026-12-20')),
    ).toBe(PassengerType.CHILD);
    expect(
      passengerTypeForAge(ageOnDate(utc('2014-12-20'), '2026-12-20')),
    ).toBe(PassengerType.ADULT);
  });

  it('handles leap-day birthdays', () => {
    expect(ageOnDate(utc('2024-02-29'), '2026-02-28')).toBe(1);
    expect(ageOnDate(utc('2024-02-29'), '2026-03-01')).toBe(2);
  });
});

describe('prices in integer cents (FLT-12b, FLT-19)', () => {
  it('has no floating point drift', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(fromCents(toCents(19.99))).toBe(19.99);
    expect(toCents(1234.56)).toBe(123456);
  });

  it('adults and children pay the full fare, infants 10%', () => {
    const fare = toCents(250);
    expect(fareCentsFor(PassengerType.ADULT, fare)).toBe(25000);
    expect(fareCentsFor(PassengerType.CHILD, fare)).toBe(25000);
    expect(fareCentsFor(PassengerType.INFANT, fare)).toBe(2500);
  });

  it('rounds the infant fare to the cent', () => {
    expect(fareCentsFor(PassengerType.INFANT, toCents(99.99))).toBe(1000); // 9.999 -> 10.00
  });

  it('charges every extra bag', () => {
    expect(baggageFeeCents(0, 35)).toBe(0);
    expect(baggageFeeCents(3, 35.5)).toBe(10650);
  });
});

describe('passport masking', () => {
  it('shows only the last 4 characters', () => {
    expect(maskPassport('A1234567')).toBe('****4567');
    expect(maskPassport('AB12')).toBe('****');
  });
});
