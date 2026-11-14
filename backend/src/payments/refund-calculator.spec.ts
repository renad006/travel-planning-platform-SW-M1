import {
  calculateRefund,
  calculateRefundPercent,
  daysRemaining,
  fromAirlineTiers,
  RefundTier,
} from './refund-calculator';

describe('refund-calculator', () => {
  const tiers: RefundTier[] = [
    { daysBeforeDeparture: 7, refundPercentage: 100 },
    { daysBeforeDeparture: 3, refundPercentage: 50 },
    { daysBeforeDeparture: 1, refundPercentage: 25 },
  ];

  it('refunds 100% for provider-initiated cancellations regardless of timing', () => {
    const anchor = new Date('2026-12-01T00:00:00Z');
    const now = new Date('2026-11-30T00:00:00Z');
    const result = calculateRefund({
      tiers,
      bookingAmount: 1000,
      cancellationAnchor: anchor,
      providerInitiated: true,
      now,
    });
    expect(result.percent).toBe(100);
    expect(result.amount).toBe(1000);
  });

  it('picks the highest qualifying tier', () => {
    const anchor = new Date('2026-12-10T00:00:00Z');
    const now = new Date('2026-12-01T00:00:00Z');
    const result = calculateRefund({ tiers, bookingAmount: 1000, cancellationAnchor: anchor, now });
    expect(result.daysRemaining).toBe(9);
    expect(result.percent).toBe(100);
    expect(result.amount).toBe(1000);
  });

  it('returns 0% when cancelling too close to departure for any tier', () => {
    const anchor = new Date('2026-12-10T00:00:00Z');
    const now = new Date('2026-12-09T12:00:00Z');
    const result = calculateRefund({ tiers, bookingAmount: 1000, cancellationAnchor: anchor, now });
    expect(result.daysRemaining).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.amount).toBe(0);
  });

  it('never returns negative days remaining when cancelling after departure', () => {
    const anchor = new Date('2026-12-01T00:00:00Z');
    const now = new Date('2026-12-05T00:00:00Z');
    expect(daysRemaining(anchor, now)).toBe(0);
  });

  it('rounds the refund amount to the nearest cent', () => {
    expect(calculateRefundPercent(tiers, 3)).toBe(50);
    const refund = calculateRefund({
      tiers,
      bookingAmount: 999,
      cancellationAnchor: new Date('2026-12-10T00:00:00Z'),
      now: new Date('2026-12-07T00:00:00Z'),
    });
    expect(refund.percent).toBe(50);
    expect(refund.amount).toBe(499.5);
  });

  it('fromAirlineTiers maps cancellationTiers into RefundTier[]', () => {
    const mapped = fromAirlineTiers([{ daysBeforeDeparture: 5, refundPercentage: 80 }]);
    expect(mapped).toEqual([{ daysBeforeDeparture: 5, refundPercentage: 80 }]);
  });
});