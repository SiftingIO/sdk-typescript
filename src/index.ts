/**
 * @siftingio/sdk — official TypeScript SDK for the SiftingIO market data API.
 *
 * @example
 * ```ts
 * import { SiftingClient } from "@siftingio/sdk";
 * const sifting = new SiftingClient({ apiKey: process.env.SIFTING_API_KEY });
 * const quote = await sifting.last.quote("crypto", "BTCUSD");
 * ```
 */

export { SiftingClient } from "./client.js";

// HTTP / config types
export type {
  SiftingClientOptions,
  RequestOptions,
  QueryValue,
  FetchLike,
} from "./http.js";

// Errors
export {
  SiftingError,
  SiftingApiError,
  SiftingConnectionError,
  isSiftingApiError,
  type SiftingErrorBody,
} from "./errors.js";

// Pagination helpers
export { autoPaginate, collectAll } from "./pagination.js";

// Shared types
export type {
  ListMeta,
  ListResponse,
  PageParams,
  Venue,
  Chain,
  BarInterval,
  CommodityBarInterval,
  BarOrder,
  Impact,
  Loose,
} from "./types.js";

// Resource classes + their types
export { LastResource } from "./resources/last.js";
export type { LastTrade, LastQuote, LastTVL } from "./resources/last.js";

export { StocksResource } from "./resources/stocks.js";
export type {
  StockSearchResult,
  CompanyProfile,
  Filing,
  FilingDetail,
  FilingSectionCode,
  FilingSection,
  FilingSections,
  FilingSectionDetail,
  FilingRef,
  DiffPair,
  SectionDiff,
  SectionDiffStats,
  RiskFactorsDiff,
  MetricValue,
  ConceptBlock,
  Financials,
  FinancialConcept,
  ScreenerRow,
  ScreenerResult,
  FinancialRatio,
  Ratios,
  EventFiling,
  OwnershipFiling,
  CompensationFiling,
  InsiderTransaction,
  Bar,
  BarsMeta,
  BarsResponse,
  SearchParams,
  FilingsParams,
  EventsParams,
  ScreenerParams,
  StockBarsParams,
} from "./resources/stocks.js";

export { FilersResource } from "./resources/filers.js";
export type { HoldingPosition, Holdings } from "./resources/filers.js";

export { MarketsResource } from "./resources/markets.js";
export type {
  Region,
  MarketStats,
  Market,
  MarketStatus,
  Break,
  HoursSpec,
  ForexSession,
  MarketHours,
  CalendarDay,
  MarketsEnvelope,
  CalendarParams,
} from "./resources/markets.js";

export { ForexResource } from "./resources/forex.js";
export type { ForexBarsParams } from "./resources/forex.js";

export { CommoditiesResource } from "./resources/commodities.js";
export type { CommodityBarsParams } from "./resources/commodities.js";

export { CryptoResource } from "./resources/crypto.js";
export type { CryptoBarsParams } from "./resources/crypto.js";

export { DexResource } from "./resources/dex.js";
export type { WalletToken, WalletPortfolio } from "./resources/dex.js";

export { EconomicCalendarResource } from "./resources/economic-calendar.js";
export type {
  Agency,
  EconomicEvent,
  EconomicCalendarFilter,
  EconomicCalendarResponse,
  EconomicCalendarParams,
} from "./resources/economic-calendar.js";

// WebSocket
export { SiftingSocket } from "./ws/client.js";
export type {
  SiftingSocketOptions,
  MinimalWebSocket,
  WebSocketCtor,
} from "./ws/client.js";
export type {
  WsProduct,
  WsClientOp,
  WsAck,
  WsPong,
  WsTick,
  WsTVL,
  WsErrorFrame,
  WsServerFrame,
  WsEventMap,
} from "./ws/types.js";
