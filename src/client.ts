import { HttpClient, type SiftingClientOptions } from "./http.js";
import { CryptoResource } from "./resources/crypto.js";
import { DexResource } from "./resources/dex.js";
import { EconomicCalendarResource } from "./resources/economic-calendar.js";
import { FilersResource } from "./resources/filers.js";
import { ForexResource } from "./resources/forex.js";
import { LastResource } from "./resources/last.js";
import { MarketsResource } from "./resources/markets.js";
import { StocksResource } from "./resources/stocks.js";
import { SiftingSocket, type SiftingSocketOptions } from "./ws/client.js";

/**
 * The SiftingIO API client.
 *
 * ```ts
 * import { SiftingClient } from "@siftingio/sdk";
 *
 * const sifting = new SiftingClient({ apiKey: process.env.SIFTING_API_KEY });
 *
 * const trade = await sifting.last.trade("crypto", "BTCUSD");
 * const profile = await sifting.stocks.profile("AAPL");
 * ```
 *
 * Resources mirror the API's URL structure, so the docs map 1:1 onto methods.
 * For browser apps, do not embed a production key — see {@link SiftingClientOptions.apiKey}.
 */
export class SiftingClient {
  private readonly http: HttpClient;

  /** Live market data: `/v1/last/*`. */
  readonly last: LastResource;
  /** US equities fundamentals + history: `/v1/fnd/stocks/*`, `/v1/hist/stocks/*`. */
  readonly stocks: StocksResource;
  /** 13F institutional holdings: `/v1/fnd/filers/*`. */
  readonly filers: FilersResource;
  /** Market catalog, status, hours, calendars: `/v1/fnd/markets/*`. */
  readonly markets: MarketsResource;
  /** Forex OHLC bars: `/v1/hist/forex/*`. */
  readonly forex: ForexResource;
  /** Crypto OHLCV bars: `/v1/hist/crypto/*`. */
  readonly crypto: CryptoResource;
  /** On-chain wallet portfolios: `/v1/fnd/dex/*`. */
  readonly dex: DexResource;
  /** US macro economic calendar: `/v1/fnd/economic-calendar`. */
  readonly economicCalendar: EconomicCalendarResource;

  constructor(options: SiftingClientOptions = {}) {
    this.http = new HttpClient(options);
    this.last = new LastResource(this.http);
    this.stocks = new StocksResource(this.http);
    this.filers = new FilersResource(this.http);
    this.markets = new MarketsResource(this.http);
    this.forex = new ForexResource(this.http);
    this.crypto = new CryptoResource(this.http);
    this.dex = new DexResource(this.http);
    this.economicCalendar = new EconomicCalendarResource(this.http);
  }

  /**
   * Create a live WebSocket client. Call `.connect()` then `.subscribe(...)`.
   * Reuses this client's API key and `wsUrl`.
   */
  ws(options: SiftingSocketOptions = {}): SiftingSocket {
    return new SiftingSocket(this.http, options);
  }
}
