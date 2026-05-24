import type { HttpClient } from "../http.js";
import type { Impact, Loose } from "../types.js";

/** Issuing agency for a US macro release. */
export type Agency = "BLS" | "BEA" | "Census" | "Fed" | "DOL" | "EIA";

/** A scheduled or released economic event. `actual`/`previous`/`consensus` are null until known. */
export interface EconomicEvent {
  /** Recurring event id, e.g. `us_cpi`. */
  event_id: string;
  name: string;
  /** Two-letter country code. */
  country: string;
  /** ISO 4217 currency. */
  currency: string;
  agency: string;
  impact: string;
  /** Scheduled release instant, RFC3339. */
  scheduled_at: string;
  actual: number | null;
  previous: number | null;
  consensus: number | null;
  /** When the actual was released, RFC3339; null while pending. */
  released_at: string | null;
}

/** The echoed filter applied to the query. */
export interface EconomicCalendarFilter {
  from: string;
  to: string;
  country: string;
  impact?: string;
  agency?: string;
  event_id?: string;
  limit: number;
}

export interface EconomicCalendarResponse {
  events: EconomicEvent[];
  count: number;
  filter: EconomicCalendarFilter;
}

export interface EconomicCalendarParams {
  /** Lower bound, `YYYY-MM-DD` or RFC3339. Default: now. */
  from?: string;
  /** Upper bound, `YYYY-MM-DD` or RFC3339. Default: from + 30 days. */
  to?: string;
  /** Two-letter country code. Default: `US`. */
  country?: string;
  /** Filter by impact level. */
  impact?: Loose<Impact>;
  /** Filter by issuing agency. */
  agency?: Loose<Agency>;
  /** Filter to a single recurring event, e.g. `us_cpi`. */
  event_id?: string;
  /** 1–500. Default 100. */
  limit?: number;
}

/** `/v1/fnd/economic-calendar` — upcoming and released US macro events. */
export class EconomicCalendarResource {
  constructor(private readonly http: HttpClient) {}

  /** Query the economic calendar. `GET /v1/fnd/economic-calendar`. */
  list(params: EconomicCalendarParams = {}): Promise<EconomicCalendarResponse> {
    return this.http.get(`/v1/fnd/economic-calendar`, { query: { ...params } });
  }
}
