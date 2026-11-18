import { parseLatestResponse } from './fx-rates.client';

const good = {
  success: true,
  timestamp: 1783883940,
  date: '2026-07-12T19:19:00.000Z',
  base: 'USD',
  rates: { EUR: 0.87, GBP: 0.74, JPY: 150, EGP: 48.5, AED: 3.67 },
};

describe('FX provider response parsing (ITN-18)', () => {
  it('accepts a normal response and adds the base with rate 1', () => {
    const r = parseLatestResponse(good, 'USD');
    expect(r.base).toBe('USD');
    expect(r.rates.USD).toBe(1);
    expect(r.rates.EUR).toBe(0.87);
    expect(r.rateDate.toISOString()).toBe(new Date(1783883940 * 1000).toISOString());
  });

  it('reads the date from the date field when there is no timestamp', () => {
    const { timestamp: _t, ...noTs } = good;
    expect(parseLatestResponse(noTs, 'USD').rateDate.toISOString()).toBe('2026-07-12T19:19:00.000Z');
  });

  it('accepts a timestamp in milliseconds too', () => {
    expect(parseLatestResponse({ ...good, timestamp: 1783883940000 }, 'USD').rateDate.getTime()).toBe(
      1783883940000,
    );
  });

  it('uppercases codes and drops junk entries', () => {
    const r = parseLatestResponse(
      { ...good, rates: { ...good.rates, eur: 0.9, BAD: -1, ZERO: 0, NAN: NaN, TXT: '1', XY: 2, LONG1: 3 } },
      'USD',
    );
    expect(r.rates.EUR).toBe(0.9);
    for (const code of ['BAD', 'ZERO', 'NAN', 'TXT', 'XY', 'LONG1']) expect(r.rates[code]).toBeUndefined();
  });

  it('rejects an error response (nested message or plain string)', () => {
    expect(() => parseLatestResponse({ success: false, error: { message: 'invalid key' } }, 'USD')).toThrow(
      /invalid key/,
    );
    expect(() => parseLatestResponse({ success: false, error: 'quota exceeded' }, 'USD')).toThrow(
      /quota exceeded/,
    );
    expect(() => parseLatestResponse({ success: false }, 'USD')).toThrow(/error/);
  });

  it('rejects anything that is not a usable rates object', () => {
    for (const bad of [null, undefined, 'x', 5, [], {}, { rates: null }, { rates: [] }, { rates: 'x' }]) {
      expect(() => parseLatestResponse(bad, 'USD')).toThrow();
    }
  });

  it('rejects too few valid rates and a different base', () => {
    expect(() => parseLatestResponse({ ...good, rates: { EUR: 0.9 } }, 'USD')).toThrow(/too few/);
    expect(() => parseLatestResponse({ ...good, base: 'EUR' }, 'USD')).toThrow(/base/);
  });
});
