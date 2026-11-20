import { convertAmount, convertMoney, crossRate, isSupportedCurrency } from './fx-conversion';

// base USD: 1 USD = 0.5 EUR = 2 GBP... (round numbers so the maths is easy to check by hand)
const rates = { USD: 1, EUR: 0.5, GBP: 0.25, JPY: 100 };

describe('FX conversion (ITN-18)', () => {
  it('knows which currencies have a rate', () => {
    expect(isSupportedCurrency(rates, 'EUR')).toBe(true);
    expect(isSupportedCurrency(rates, 'USD')).toBe(true);
    expect(isSupportedCurrency(rates, 'XXX')).toBe(false);
    expect(isSupportedCurrency(rates, 'constructor')).toBe(false); // not an object property trick
    expect(isSupportedCurrency({ EUR: 0 }, 'EUR')).toBe(false);
  });

  it('converts through the base currency', () => {
    expect(convertAmount(rates, 10, 'USD', 'EUR')).toBe(5);
    expect(convertAmount(rates, 5, 'EUR', 'USD')).toBe(10);
    expect(convertAmount(rates, 10, 'EUR', 'GBP')).toBe(5); // 10 EUR = 20 USD = 5 GBP
    expect(convertAmount(rates, 1, 'USD', 'JPY')).toBe(100);
    expect(crossRate(rates, 'EUR', 'GBP')).toBe(0.5);
  });

  it('same currency stays the same and is rounded to 2 decimals', () => {
    expect(convertAmount(rates, 12.345, 'EUR', 'EUR')).toBe(12.35);
    expect(convertAmount(rates, 0, 'EUR', 'USD')).toBe(0);
  });

  it('rounds to cents once at the end', () => {
    expect(convertAmount({ USD: 1, EUR: 0.923456 }, 100, 'USD', 'EUR')).toBe(92.35);
    expect(convertAmount({ USD: 1, EUR: 0.9 }, 0.1 + 0.2, 'USD', 'EUR')).toBe(0.27);
  });

  it('returns null for an unknown currency or a bad amount, never a guess', () => {
    expect(convertAmount(rates, 10, 'XXX', 'EUR')).toBeNull();
    expect(convertAmount(rates, 10, 'EUR', 'XXX')).toBeNull();
    expect(convertAmount(rates, NaN, 'EUR', 'USD')).toBeNull();
    expect(convertAmount(rates, Infinity, 'EUR', 'USD')).toBeNull();
    expect(crossRate(rates, 'EUR', 'XXX')).toBeNull();
  });

  it('converts a per-currency money map into one amount', () => {
    const r = convertMoney(rates, { EUR: 10, USD: 10, GBP: 5 }, 'USD');
    // 10 EUR = 20 USD, 10 USD, 5 GBP = 20 USD
    expect(r).toEqual({ amount: 50, currency: 'USD', unconverted: {} });
  });

  it('leaves currencies without a rate unconverted instead of guessing', () => {
    const r = convertMoney(rates, { EUR: 10, UNSPECIFIED: 15, XXX: 3 }, 'USD');
    expect(r.amount).toBe(20);
    expect(r.unconverted).toEqual({ UNSPECIFIED: 15, XXX: 3 });
  });

  it('an empty or missing map converts to zero', () => {
    expect(convertMoney(rates, {}, 'EUR')).toEqual({ amount: 0, currency: 'EUR', unconverted: {} });
    expect(convertMoney(rates, undefined as never, 'EUR').amount).toBe(0);
  });

  it('keeps cents exact when adding several currencies', () => {
    const r = convertMoney({ USD: 1, EUR: 1 }, { USD: 0.1, EUR: 0.2 }, 'USD');
    expect(r.amount).toBe(0.3);
  });
});
