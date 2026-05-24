import type { HttpClient } from "../http.js";
import type { BarsResponse, StockBarsParams } from "./stocks.js";

export interface CryptoBarsParams extends Omit<StockBarsParams, "cursor"> {
  /** Inclusive lower bound, `YYYY-MM-DD` or RFC3339 (UTC). Required. */
  start: string;
  /** Opaque pagination cursor. */
  cursor?: string;
}

/**
 * `/v1/hist/crypto/*` — historical OHLCV bars for USD-quoted crypto symbols
 * (e.g. `BTCUSD`). `v` is fractional base-asset volume. Requires gzip
 * (handled automatically). The `limit` cap here is 5000 (higher than other venues).
 *
 * When `start` predates all upstreams' coverage the API returns HTTP 422 with
 * code `data_unavailable`; the {@link import("../errors.js").SiftingApiError}'s
 * `body.earliest` field carries the earliest available date.
 */
export class CryptoResource {
  constructor(private readonly http: HttpClient) {}

  /** OHLCV bars for a crypto symbol. `GET /v1/hist/crypto/:symbol/bars`. */
  bars(symbol: string, params: CryptoBarsParams): Promise<BarsResponse> {
    return this.http.get(`/v1/hist/crypto/${encodeURIComponent(symbol)}/bars`, {
      query: { ...params },
    });
  }
}
