/**
 * ITN-18: currency conversion maths. Pure functions, no database, no network.
 *
 * Rates are "units of currency X for 1 unit of the base currency" (for example base USD,
 * EUR 0.92 means 1 USD = 0.92 EUR), exactly as the exchange-rate provider returns them.
 * Any pair converts through the base: amount / rate[from] * rate[to].
 * Money is rounded to 2 decimals once per currency, never in the middle of a calculation.
 */
export type Rates = Record<string, number>;
/** Currency code -> amount, for example { EUR: 120.5, USD: 30 }. */
export type MoneyByCurrency = Record<string, number>;

export function isSupportedCurrency(rates: Rates, code: string): boolean {
  return Object.prototype.hasOwnProperty.call(rates, code) && rates[code] > 0;
}

/** Rate for 1 unit of `from` expressed in `to`, or null when either currency has no rate. */
export function crossRate(rates: Rates, from: string, to: string): number | null {
  if (!isSupportedCurrency(rates, from) || !isSupportedCurrency(rates, to)) return null;
  return rates[to] / rates[from];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Converts one amount. Returns null when either currency has no rate. */
export function convertAmount(
  rates: Rates,
  amount: number,
  from: string,
  to: string,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return round2(amount);
  const rate = crossRate(rates, from, to);
  return rate === null ? null : round2(amount * rate);
}

export interface ConvertedMoney {
  /** Everything that could be converted, in the target currency. */
  amount: number;
  currency: string;
  /** Amounts that could not be converted (no rate for that currency), left as they were. */
  unconverted: MoneyByCurrency;
}

/**
 * Converts a per-currency money map into one amount in `to`. A currency without a rate (for
 * example UNSPECIFIED) is never guessed: it is returned in `unconverted` instead.
 */
export function convertMoney(rates: Rates, money: MoneyByCurrency, to: string): ConvertedMoney {
  let cents = 0;
  const unconverted: MoneyByCurrency = {};
  for (const [currency, amount] of Object.entries(money ?? {})) {
    const converted = convertAmount(rates, amount, currency, to);
    if (converted === null) unconverted[currency] = amount;
    else cents += Math.round(converted * 100);
  }
  return { amount: cents / 100, currency: to, unconverted };
}
