export interface RefundTier {
  daysBeforeDeparture: number;
  refundPercentage: number;
}

export interface CalculateRefundInput {
  tiers: RefundTier[];
  bookingAmount: number;
  cancellationAnchor: Date;
  providerInitiated?: boolean;
  now?: Date;
}

export interface RefundResult {
  percent: number;
  amount: number;
  daysRemaining: number;
}

/** Whole days remaining between now and the cancellation anchor (departure / check-in). Never negative. */
export function daysRemaining(anchor: Date, now: Date): number {
  const diffMs = anchor.getTime() - now.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return days < 0 ? 0 : days;
}

/**
 * PAY-03 refund rule: the tier with the highest daysBeforeDeparture threshold
 * that does not exceed the days remaining. If no tier qualifies, refund is 0%.
 */
export function calculateRefundPercent(tiers: RefundTier[], days: number): number {
  const eligible = tiers
    .filter((t) => t.daysBeforeDeparture <= days)
    .sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture);
  return eligible.length > 0 ? eligible[0].refundPercentage : 0;
}

/**
 * Provider-initiated cancellations (the airline/hotel cancels) always refund 100%,
 * regardless of tiers or timing.
 */
export function calculateRefund(input: CalculateRefundInput): RefundResult {
  const now = input.now ?? new Date();

  if (input.providerInitiated) {
    return {
      percent: 100,
      amount: Math.round(input.bookingAmount * 100) / 100,
      daysRemaining: daysRemaining(input.cancellationAnchor, now),
    };
  }

  const days = daysRemaining(input.cancellationAnchor, now);
  const percent = calculateRefundPercent(input.tiers, days);
  const amount = Math.round(input.bookingAmount * percent) / 100;

  return { percent, amount, daysRemaining: days };
}

/** Converts PayableBooking.cancellationTiers (from FlightBooking/HotelBooking) into RefundTier[]. */
export function fromAirlineTiers(
  tiers: { daysBeforeDeparture: number; refundPercentage: number }[],
): RefundTier[] {
  return tiers.map((t) => ({
    daysBeforeDeparture: t.daysBeforeDeparture,
    refundPercentage: t.refundPercentage,
  }));
}