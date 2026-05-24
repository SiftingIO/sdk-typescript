import type { HttpClient } from "../http.js";
import type { Loose } from "../types.js";

/** Geographic grouping for market filters. */
export type Region =
  | "north_america"
  | "europe"
  | "asia_pacific"
  | "latam"
  | "global";

export interface MarketStats {
  market_cap_usd: number;
  listed_companies: number;
  currency: string;
  /** ISO date the stats were measured. */
  as_of: string;
}

/** A supported market/venue in the catalog. */
export interface Market {
  /** Unique lowercase slug, e.g. `nyse`, `us_equities`, `forex`, `crypto`. */
  market: string;
  name: string;
  /** `exchange` | `forex` | `crypto`. */
  type: string;
  /** IANA timezone. */
  timezone: string;
  region: string;
  /** MIC codes for exchange-type markets. */
  exchanges?: string[];
  /** Present only for exchange-type markets. */
  stats?: MarketStats;
}

/** Open/closed snapshot for one market. */
export interface MarketStatus {
  market: string;
  type: string;
  is_open: boolean;
  /** `closed` | `regular` | `open`. */
  state: string;
  /** Session detail, e.g. `pre_market`, `regular`, `post_market`. */
  session?: string;
  /** Next open instant, RFC3339. */
  next_open?: string;
  /** Next close instant, RFC3339. */
  next_close?: string;
  timezone: string;
  stats?: MarketStats;
}

export interface Break {
  /** `HH:MM`, venue local. */
  open: string;
  close: string;
}

export interface HoursSpec {
  /** `HH:MM`, venue local. */
  open: string;
  close: string;
  /** Intra-session breaks (e.g. lunch on some Asian exchanges). */
  breaks?: Break[];
}

export interface ForexSession {
  name: string;
  /** `HH:MM` UTC. */
  start: string;
  end: string;
}

/** Trading-hours schedule for a market. Exchange-type vs forex populate different fields. */
export interface MarketHours {
  market: string;
  type: string;
  timezone: string;
  /** Exchange schedules. */
  hours?: {
    regular?: HoursSpec;
    pre_market?: HoursSpec;
    post_market?: HoursSpec;
  };
  /** Forex continuous-session bounds. */
  opens_at?: string;
  closes_at?: string;
  /** Forex named sessions. */
  sessions?: ForexSession[];
  exchanges?: string[];
}

/** A holiday or half-day on a market calendar. */
export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
  /** `full_day_holiday` | `half_day_holiday`. */
  kind: string;
  /** `closed` | `open`. */
  state: string;
  /** Early-close instant for half-days, RFC3339. */
  early_close?: string;
}

export interface MarketsEnvelope<T> {
  data: T;
  meta: { as_of: string } & Record<string, unknown>;
}

export interface CalendarParams {
  /** Inclusive lower bound, `YYYY-MM-DD`. Default: today. */
  from?: string;
  /** Inclusive upper bound, `YYYY-MM-DD`. Default: from + 90 days. Max range 730 days. */
  to?: string;
}

/**
 * `/v1/fnd/markets/*` — market catalog, live open/closed status, weekly hours,
 * and holiday calendars for every supported equity venue plus forex and crypto.
 */
export class MarketsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all supported markets. `GET /v1/fnd/markets`. */
  list(params: { region?: Loose<Region> } = {}): Promise<MarketsEnvelope<Market[]>> {
    return this.http.get(`/v1/fnd/markets`, { query: { region: params.region } });
  }

  /** Open/closed snapshot for every market. `GET /v1/fnd/markets/status`. */
  statusAll(
    params: { region?: Loose<Region> } = {},
  ): Promise<MarketsEnvelope<MarketStatus[]>> {
    return this.http.get(`/v1/fnd/markets/status`, { query: { region: params.region } });
  }

  /** Open/closed snapshot for one market. `GET /v1/fnd/markets/:market/status`. */
  status(market: string): Promise<MarketsEnvelope<MarketStatus>> {
    return this.http.get(`/v1/fnd/markets/${enc(market)}/status`);
  }

  /** Weekly trading-hours schedule. `GET /v1/fnd/markets/:market/hours`. */
  hours(market: string): Promise<MarketsEnvelope<MarketHours>> {
    return this.http.get(`/v1/fnd/markets/${enc(market)}/hours`);
  }

  /** Holiday/half-day calendar for a date range. `GET /v1/fnd/markets/:market/calendar`. */
  calendar(
    market: string,
    params: CalendarParams = {},
  ): Promise<MarketsEnvelope<CalendarDay[]>> {
    return this.http.get(`/v1/fnd/markets/${enc(market)}/calendar`, {
      query: { from: params.from, to: params.to },
    });
  }
}

const enc = encodeURIComponent;
