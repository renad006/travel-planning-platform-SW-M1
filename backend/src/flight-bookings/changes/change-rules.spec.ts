import { PassengerType, SegmentDirection } from '../schemas/flight-booking.enums';
import {
  fareDifference,
  passengersOverBagLimit,
  passengersWhoseTypeWouldChange,
  segmentFareCents,
  segmentOrderProblem,
} from './change-rules';

const A = PassengerType.ADULT;
const C = PassengerType.CHILD;
const I = PassengerType.INFANT;

describe('FLT-27 change rules', () => {
  describe('fares', () => {
    it('adults and children pay the fare, infants 10%', () => {
      expect(segmentFareCents([{ type: A }, { type: C }, { type: I }], 10000)).toBe(21000);
    });

    it('compares the new fare with the fare paid', () => {
      expect(fareDifference(21000, 25200)).toEqual({ amount: 42, direction: 'pay' });
      expect(fareDifference(21000, 16800)).toEqual({ amount: 42, direction: 'refund' });
      expect(fareDifference(21000, 21000)).toEqual({ amount: 0, direction: 'none' });
    });

    it('works in cents, so there is no rounding drift', () => {
      expect(fareDifference(10, 30)).toEqual({ amount: 0.2, direction: 'pay' });
    });
  });

  describe('passenger types on a new outbound date', () => {
    const pax = [
      { type: A, fullName: 'Ada', dateOfBirth: new Date('1990-05-10') },
      { type: C, fullName: 'Chi', dateOfBirth: new Date('2017-03-02') },
      { type: I, fullName: 'Inf', dateOfBirth: new Date('2026-03-01') },
    ];

    it('accepts a date where nobody changes group', () => {
      expect(passengersWhoseTypeWouldChange(pax, '2026-12-10')).toEqual([]);
    });

    it('blocks the infant who turns 2', () => {
      expect(passengersWhoseTypeWouldChange(pax, '2028-03-02')).toEqual(['Inf']);
    });

    it('blocks the child who turns 12', () => {
      expect(passengersWhoseTypeWouldChange(pax.slice(1, 2), '2029-03-02')).toEqual(['Chi']);
    });
  });

  describe('bags', () => {
    it('flags a passenger whose bags are too heavy for the new flight', () => {
      const pax = [
        { fullName: 'Ada', extraBags: 2, extraBagWeightKg: 40 },
        { fullName: 'Chi', extraBags: 0, extraBagWeightKg: 0 },
      ];
      expect(passengersOverBagLimit(pax, 20)).toEqual([]);
      expect(passengersOverBagLimit(pax, 15)).toEqual(['Ada']);
    });
  });

  describe('round trip order', () => {
    const t = (d: string, a: string) => ({ departureTime: new Date(d), arrivalTime: new Date(a) });
    const back = t('2026-12-20T10:00:00Z', '2026-12-20T13:00:00Z');
    const out = t('2026-12-10T10:00:00Z', '2026-12-10T13:00:00Z');

    it('has no rule for a one-way booking', () => {
      expect(segmentOrderProblem(SegmentDirection.OUTBOUND, out, null)).toBeNull();
    });

    it('a new outbound must land before the return departs', () => {
      expect(segmentOrderProblem(SegmentDirection.OUTBOUND, out, back)).toBeNull();
      expect(
        segmentOrderProblem(SegmentDirection.OUTBOUND, t('2026-12-20T09:00:00Z', '2026-12-20T12:00:00Z'), back),
      ).toMatch(/land after your return/);
    });

    it('a new return must depart after the outbound lands', () => {
      expect(segmentOrderProblem(SegmentDirection.RETURN, back, out)).toBeNull();
      expect(
        segmentOrderProblem(SegmentDirection.RETURN, t('2026-12-10T12:00:00Z', '2026-12-10T15:00:00Z'), out),
      ).toMatch(/before your outbound/);
    });
  });
});
