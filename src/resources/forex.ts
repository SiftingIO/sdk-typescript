import type { HttpClient } from "../http.js";
import type { BarsResponse, StockBarsParams } from "./stocks.js";

export interface ForexBarsParams extends Omit<StockBarsParams, "cursor"> {
  /** Inclusive lower bound, `YYYY-MM-DD` or RFC3339 (UTC). Required. */
  start: string;
  /** Opaque pagination cursor. */
  cursor?: string;
}

/**
 * `/v1/hist/forex/*` — historical OHLC bars for FX pairs. Volume (`v`) is
 * always 0 for OTC spot forex. Requires gzip (handled automatically).
 */
export class ForexResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * OHLC bars for a 6-char FX pair, e.g. `bars("EURUSD", { start: "2024-01-01" })`.
   * `GET /v1/hist/forex/:pair/bars`.
   */
  bars(pair: string, params: ForexBarsParams): Promise<BarsResponse> {
    return this.http.get(`/v1/hist/forex/${encodeURIComponent(pair)}/bars`, {
      query: { ...params },
    });
  }
}
