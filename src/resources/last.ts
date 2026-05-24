import type { HttpClient } from "../http.js";
import type { Chain, Loose, Venue } from "../types.js";

/**
 * Latest trade snapshot. Prices/sizes are decimal strings (preserved exactly
 * as published, no float rounding); `t` is Unix epoch milliseconds.
 */
export interface LastTrade {
  /** Symbol, normalized to the venue's canonical form. */
  s: string;
  /** Last trade price. */
  p: string;
  /** Last trade size. */
  P: string;
  /** Timestamp, Unix epoch milliseconds. */
  t: number;
}

/** Top-of-book quote: best bid/ask with sizes. */
export interface LastQuote {
  /** Bid price. */
  b: string;
  /** Bid size. */
  B: string;
  /** Ask price. */
  a: string;
  /** Ask size. */
  A: string;
  /** Timestamp, Unix epoch milliseconds. */
  t: number;
}

/** Aggregated DEX pool TVL for a chain/pair. */
export interface LastTVL {
  /** Canonical lowercase chain. */
  chain: string;
  /** Canonical uppercase pair, e.g. `WETH-USDC`. */
  pair: string;
  /** Total value locked, USD. */
  usd: string;
  /** Reserve of token0. */
  r0: string;
  /** Reserve of token1. */
  r1: string;
  /** Number of pools aggregated. */
  n: number;
  /** Version/volume counter. */
  v: number;
  /** Timestamp, Unix epoch milliseconds. */
  t: number;
}

/**
 * `/v1/last/*` — live market data read straight from the engine's Redis
 * snapshot. Never cached at the edge; each call returns the freshest tick.
 */
export class LastResource {
  constructor(private readonly http: HttpClient) {}

  /** Latest trade for a symbol on a venue. `GET /v1/last/trade/:venue/:symbol`. */
  trade(venue: Loose<Venue>, symbol: string): Promise<LastTrade> {
    return this.http.get<LastTrade>(
      `/v1/last/trade/${enc(venue)}/${enc(symbol)}`,
    );
  }

  /** Top-of-book quote for a symbol on a venue. `GET /v1/last/quote/:venue/:symbol`. */
  quote(venue: Loose<Venue>, symbol: string): Promise<LastQuote> {
    return this.http.get<LastQuote>(
      `/v1/last/quote/${enc(venue)}/${enc(symbol)}`,
    );
  }

  /** Aggregated TVL for a DEX pair. `GET /v1/last/tvl/:chain/:pair` (e.g. `tvl("eth", "WETH-USDC")`). */
  tvl(chain: Loose<Chain>, pair: string): Promise<LastTVL> {
    return this.http.get<LastTVL>(`/v1/last/tvl/${enc(chain)}/${enc(pair)}`);
  }
}

const enc = encodeURIComponent;
