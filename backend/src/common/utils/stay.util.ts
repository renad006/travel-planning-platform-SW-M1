import { BadRequestException } from '@nestjs/common';

const DAY_MS = 24 * 60 * 60 * 1000;

// HTL-11 / HTL-15 / HTL-18: check-out after check-in, and check-in not in the past
export function parseStay(checkInText: string, checkOutText: string) {
  const checkIn = new Date(checkInText);
  const checkOut = new Date(checkOutText);
  if (checkOut <= checkIn) {
    throw new BadRequestException('Check-out must be after check-in');
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (checkIn < today) {
    throw new BadRequestException('Check-in cannot be in the past');
  }
  return { checkIn, checkOut };
}

// Each night of the stay, starting at check-in, ending the night before check-out
export function nightsOf(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY_MS) {
    nights.push(new Date(t));
  }
  return nights;
}
