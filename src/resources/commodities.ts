import type { BarOrder, CommodityBarInterval } from "../types.js";
import type { HttpClient } from "../http.js";
import type { BarsResponse, StockBarsParams } from "./stocks.js";

export interface CommodityBarsParams
  extends Omit<StockBarsParams, "cursor" | "interval"> {
  /** Inclusive lower bound, `YYYY-MM-DD` or RFC3339 (UTC). Required. */
  start: string;
  /** `1m` | `5m` | `15m` | `30m` | `1h` | `1d`. Default `1m`. */
  interval?: CommodityBarInterval;
  /** Opaque pagination cursor. */
  cursor?: string;
  /** Sort direction. `asc` (default) oldest→newest; `desc` newest first. */
  order?: BarOrder;
}

/**
 * `/v1/hist/commodities/*` — historical OHLC bars for commodities: precious
 * metals (XAUUSD, XAGUSD, XPTUSD, XPDUSD), energy, and industrials (e.g.
 * XCUUSD copper, USOUSD WTI, NATGAS). Supports the `1d` interval and
 * `asc`/`desc` ordering. Requires gzip (handled automatically).
 */
export class CommoditiesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * OHLC bars for a commodity code, e.g.
   * `bars("XAUUSD", { start: "2024-01-01", interval: "1d", order: "desc" })`.
   * `GET /v1/hist/commodities/:symbol/bars`.
   */
  bars(symbol: string, params: CommodityBarsParams): Promise<BarsResponse> {
    return this.http.get(
      `/v1/hist/commodities/${encodeURIComponent(symbol)}/bars`,
      { query: { ...params } },
    );
  }
}
