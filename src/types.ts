/**
 * Cross-cutting types shared by multiple resources: the standard list
 * envelope, pagination params, and a few reused string unions.
 *
 * Per-endpoint response types live next to the resource that returns them
 * (see `src/resources/*.ts`). String unions accept a free-form `string`
 * fallback (`Venue | (string & {})`) so a server-side addition never makes a
 * pinned SDK reject a value it doesn't yet know about.
 */

/** `meta` block returned by paginated `/v1/fnd/*` list endpoints. */
export interface ListMeta {
  /** Opaque cursor for the next page. Absent when there is no next page. */
  next_cursor?: string;
  /** RFC3339 timestamp of when the data was assembled. */
  as_of: string;
  /** Total count across all pages, when the endpoint computes it. */
  total?: number;
}

/** Envelope for paginated list endpoints: `{ data, meta }`. */
export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

/** Cursor-pagination query params accepted by list endpoints. */
export interface PageParams {
  /** Opaque cursor from a previous response's `meta.next_cursor`. */
  cursor?: string;
  /** Page size. Each endpoint documents its own default and max. */
  limit?: number;
}

/** Live-data venues for `/v1/last/trade` and `/v1/last/quote`. */
export type Venue = "stocks" | "crypto" | "forex" | "dex";

/** EVM chains supported by DEX/TVL endpoints. */
export type Chain = "eth" | "base" | "arbitrum" | "bsc" | "polygon";

/** OHLCV bar intervals for `/v1/hist/*` endpoints. */
export type BarInterval = "1m" | "5m" | "15m" | "30m" | "1h";

/** Bar intervals for commodities, which additionally support daily candles. */
export type CommodityBarInterval = BarInterval | "1d";

/**
 * Time sort direction for OHLC bars. `asc` (default) is oldest→newest;
 * `desc` is newest→oldest with the first page anchored at the latest bar.
 * Honored on forex and commodities only.
 */
export type BarOrder = "asc" | "desc";

/** Economic-event / market-impact level. */
export type Impact = "low" | "medium" | "high";

/** Allow a known union while still accepting future server-side values. */
export type Loose<T extends string> = T | (string & {});
