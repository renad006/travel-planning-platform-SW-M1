/**
 * ITN-18: talks to the public exchange-rate API (FXRatesAPI) and checks what it returns.
 * The response is never trusted: bad, empty or odd data is rejected, so a broken provider can
 * never poison the cached rates.
 *
 *   GET {baseUrl}/latest?base=USD      (key as `Authorization: Bearer <key>`, never in the URL)
 *   -> { success, timestamp (unix seconds), date, base, rates: { EUR: 0.92, ... } }
 */
export interface LatestRates {
  base: string;
  /** Always contains the base itself with rate 1. */
  rates: Record<string, number>;
  /** When the provider says the rates are from. */
  rateDate: Date;
}

const CODE = /^[A-Z]{3}$/;
const MIN_CURRENCIES = 5;
const MAX_BODY_CHARS = 2_000_000;

export function parseLatestResponse(body: unknown, expectedBase: string): LatestRates {
  if (!body || typeof body !== 'object') throw new Error('response is not a JSON object');
  const b = body as Record<string, unknown>;

  if (b.success === false) {
    const err = b.error;
    const detail =
      typeof err === 'string'
        ? err
        : err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'unknown error';
    throw new Error(`provider reported an error: ${detail}`);
  }
  if (typeof b.base === 'string' && b.base.toUpperCase() !== expectedBase) {
    throw new Error(`unexpected base currency ${b.base}`);
  }
  if (!b.rates || typeof b.rates !== 'object' || Array.isArray(b.rates)) {
    throw new Error('response has no rates');
  }

  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(b.rates as Record<string, unknown>)) {
    const upper = code.toUpperCase();
    // keep only sane values: a 3-letter code and a finite rate above zero
    if (CODE.test(upper) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
      rates[upper] = value;
    }
  }
  if (Object.keys(rates).length < MIN_CURRENCIES) throw new Error('too few valid rates');
  rates[expectedBase] = 1;

  return { base: expectedBase, rates, rateDate: parseRateDate(b) };
}

function parseRateDate(b: Record<string, unknown>): Date {
  const ts = b.timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
    // seconds, but accept milliseconds too
    const date = new Date(ts > 1e12 ? ts : ts * 1000);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof b.date === 'string') {
    const date = new Date(b.date);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export interface FetchOptions {
  baseUrl: string;
  apiKey?: string;
  base: string;
  timeoutMs?: number;
}

export async function fetchLatestRates(options: FetchOptions): Promise<LatestRates> {
  const url = `${options.baseUrl.replace(/\/+$/, '')}/latest?base=${encodeURIComponent(options.base)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(options.timeoutMs ?? 8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BODY_CHARS) throw new Error('response too large');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('response is not valid JSON');
  }
  return parseLatestResponse(json, options.base);
}
