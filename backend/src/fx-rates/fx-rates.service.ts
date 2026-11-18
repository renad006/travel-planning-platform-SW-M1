import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConvertedMoney,
  MoneyByCurrency,
  Rates,
  convertAmount,
  convertMoney,
  crossRate,
  isSupportedCurrency,
} from './fx-conversion';
import { fetchLatestRates } from './fx-rates.client';
import { FxRateSnapshot, FxRateSnapshotDocument } from './schemas/fx-rate-snapshot.schema';

/** The platform's rates, as used by every conversion. */
export interface CurrentRates {
  base: string;
  rates: Rates;
  /** The date the provider says the rates are from: show this to the user (ITN-18). */
  rateDate: Date;
  fetchedAt: Date;
  /** true when today's fetch failed and the last cached rates are being used. */
  stale: boolean;
}

const DEFAULT_BASE_URL = 'https://api.fxratesapi.com';
const BASE_CURRENCY = 'USD';
/** After a failed fetch, wait this long before asking the provider again. */
const RETRY_AFTER_FAILURE_MS = 15 * 60 * 1000;
/** Old daily snapshots are deleted, the newest ones are kept. */
const KEEP_SNAPSHOTS = 30;

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * ITN-18: exchange rates for itinerary budgets (Member 3).
 *
 *  - Rates are fetched from the public exchange-rate API ONCE PER DAY and cached in the database
 *    (one document per UTC day), so conversions never call the provider and survive restarts.
 *  - If the provider is down or answers badly, the last cached rates are used (`stale: true`) and
 *    the provider is not asked again for 15 minutes.
 *  - The API key stays in the backend (FXRATES_API_KEY) and is never sent to the browser.
 *  - Booking prices are NOT converted (PAY-04); only itinerary budget amounts are.
 */
@Injectable()
export class FxRatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FxRatesService.name);
  private inflight: Promise<FxRateSnapshotDocument | null> | null = null;
  private retryNotBefore = 0;

  constructor(
    @InjectModel(FxRateSnapshot.name)
    private readonly snapshots: Model<FxRateSnapshotDocument>,
    private readonly config: ConfigService,
  ) {}

  /** Warm the cache at startup without ever blocking or crashing the app. */
  onApplicationBootstrap(): void {
    void this.refreshIfNeeded(false).catch(() => undefined);
  }

  /** Once a day, shortly after midnight UTC, even if nobody asked for a conversion. */
  @Cron('0 10 0 * * *', { timeZone: 'UTC' })
  async dailyRefresh(): Promise<void> {
    await this.refreshIfNeeded(true).catch(() => undefined);
  }

  /**
   * The rates to use now. Today's cached rates when there are any, otherwise it fetches them
   * (once); if that fails it falls back to the newest cached rates. Only when there has never
   * been a successful fetch is it a 503.
   */
  async getRates(): Promise<CurrentRates> {
    let snapshot = await this.latest();
    if (!snapshot || snapshot.fetchedDay !== utcDay(new Date())) {
      snapshot = (await this.refreshIfNeeded(false)) ?? snapshot;
    }
    if (!snapshot) {
      throw new ServiceUnavailableException('Exchange rates are not available yet, try again later');
    }
    return {
      base: snapshot.base,
      rates: snapshot.rates,
      rateDate: snapshot.rateDate,
      fetchedAt: snapshot.fetchedAt,
      stale: snapshot.fetchedDay !== utcDay(new Date()),
    };
  }

  /** The supported currency list: every currency the provider gave a rate for. */
  async supportedCurrencies() {
    const current = await this.getRates();
    return {
      base: current.base,
      rateDate: current.rateDate,
      stale: current.stale,
      currencies: Object.keys(current.rates).sort(),
    };
  }

  async isSupported(code: string): Promise<boolean> {
    return isSupportedCurrency((await this.getRates()).rates, code);
  }

  /** Convert one amount. `converted` is null when either currency has no rate. */
  async convert(amount: number, from: string, to: string) {
    const current = await this.getRates();
    return {
      amount,
      from,
      to,
      converted: convertAmount(current.rates, amount, from, to),
      rate: from === to ? 1 : crossRate(current.rates, from, to),
      rateDate: current.rateDate,
      stale: current.stale,
    };
  }

  /**
   * Convert a per-currency money map (the budget subtotals) into one amount in `to`, with the
   * rate date. Currencies without a rate come back in `unconverted`, never guessed.
   * This is what the itinerary budget summary uses (ITN-14 / ITN-18).
   */
  async convertMoney(
    money: MoneyByCurrency,
    to: string,
  ): Promise<ConvertedMoney & { rateDate: Date; stale: boolean }> {
    const current = await this.getRates();
    return { ...convertMoney(current.rates, money, to), rateDate: current.rateDate, stale: current.stale };
  }

  // ---------------- fetching and caching ----------------
  private latest(): Promise<FxRateSnapshotDocument | null> {
    return this.snapshots.findOne().sort({ fetchedAt: -1 }).exec();
  }

  /**
   * Make sure today's rates are cached. Callers at the same time share ONE provider request.
   * `force` (the daily job) ignores the wait after a failure. Returns today's snapshot, or null
   * when the provider could not be used.
   */
  private refreshIfNeeded(force: boolean): Promise<FxRateSnapshotDocument | null> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doRefresh(force).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(force: boolean): Promise<FxRateSnapshotDocument | null> {
    const today = utcDay(new Date());
    const existing = await this.snapshots.findOne({ fetchedDay: today }).exec();
    if (existing) return existing; // already fetched today (maybe by another instance)
    if (!force && Date.now() < this.retryNotBefore) return null;

    try {
      const latest = await fetchLatestRates({
        baseUrl: this.config.get<string>('FXRATES_BASE_URL') || DEFAULT_BASE_URL,
        apiKey: this.config.get<string>('FXRATES_API_KEY') || undefined,
        base: BASE_CURRENCY,
      });
      // one document per day: if another instance saved it first, keep theirs
      const saved = await this.snapshots
        .findOneAndUpdate(
          { fetchedDay: today },
          {
            $setOnInsert: {
              fetchedDay: today,
              base: latest.base,
              rates: latest.rates,
              rateDate: latest.rateDate,
              fetchedAt: new Date(),
            },
          },
          { upsert: true, returnDocument: 'after' },
        )
        .exec();
      this.retryNotBefore = 0;
      this.logger.log(`Exchange rates cached for ${today} (rates from ${latest.rateDate.toISOString()})`);
      await this.prune();
      return saved;
    } catch (error) {
      this.retryNotBefore = Date.now() + RETRY_AFTER_FAILURE_MS;
      // the message never contains the API key (it is sent as a header)
      this.logger.warn(`Could not fetch exchange rates, using the last cached ones: ${(error as Error).message}`);
      return null;
    }
  }

  /** Keep the newest snapshots only, so the collection stays tiny. */
  private async prune(): Promise<void> {
    const old = await this.snapshots
      .find({}, { _id: 1 })
      .sort({ fetchedAt: -1 })
      .skip(KEEP_SNAPSHOTS)
      .lean()
      .exec();
    if (old.length) await this.snapshots.deleteMany({ _id: { $in: old.map((d) => d._id) } });
  }
}
