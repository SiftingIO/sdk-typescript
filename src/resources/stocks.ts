import type { HttpClient } from "../http.js";
import type { BarInterval, ListResponse, PageParams } from "../types.js";

// ── Discovery & profile ──────────────────────────────────────────────────

/** One hit from the ticker/company search index. */
export interface StockSearchResult {
  ticker: string;
  name: string;
  /** 10-digit zero-padded CIK. */
  cik: string;
  exchange?: string;
}

/** Company profile assembled from SEC submissions metadata. */
export interface CompanyProfile {
  ticker: string;
  cik: string;
  name: string;
  exchanges?: string[];
  other_tickers?: string[];
  /** 4-digit SIC industry code. */
  sic_code?: string;
  sic_description?: string;
  entity_type?: string;
  /** Fiscal year end, `MMDD` (e.g. `"0930"`). */
  fiscal_year_end?: string;
}

// ── Filings ──────────────────────────────────────────────────────────────

/** A SEC filing summary as returned by the filings list. */
export interface Filing {
  /** Accession number, e.g. `0000320193-24-000123`. */
  accession: string;
  /** Form type, e.g. `10-K`, `10-Q`, `8-K`. */
  form: string;
  /** Date filed, `YYYY-MM-DD`. */
  filed_at: string;
  period_end?: string;
  /** RFC3339 acceptance timestamp. */
  accepted_at?: string;
  /** Comma-separated 8-K item codes, when applicable. */
  items?: string;
  primary_document_url?: string;
  description?: string;
  /** Whether structured XBRL financials are attached. */
  has_xbrl: boolean;
}

/** A single filing's detail, including the document file list. */
export interface FilingDetail extends Filing {
  ticker: string;
  cik: string;
  /** SEC EDGAR archive base URL for this accession. */
  archive_url: string;
  /** HTML document file names within the filing. */
  files?: string[];
}

/** Recognized 10-K/10-Q text section codes (free-form string also accepted). */
export type FilingSectionCode =
  | "business"
  | "risk-factors"
  | "legal-proceedings"
  | "mda"
  | "market-risk"
  | (string & {});

/** One extracted text section of a filing. */
export interface FilingSection {
  section: string;
  content: string;
}

/** All extracted sections for a filing. */
export interface FilingSections {
  ticker: string;
  cik: string;
  accession: string;
  form: string;
  filed_at: string;
  sections: FilingSection[];
}

/** A single extracted section's full text. */
export interface FilingSectionDetail {
  ticker: string;
  cik: string;
  accession: string;
  form: string;
  filed_at: string;
  section: string;
  content: string;
}

// ── Risk-factor diff ───────────────────────────────────────────────────────

export interface FilingRef {
  accession: string;
  form: string;
  filed_at: string;
  period_end?: string;
}

export interface DiffPair {
  before: string;
  after: string;
}

export interface SectionDiffStats {
  before_paragraphs: number;
  after_paragraphs: number;
  unchanged_count: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
}

export interface SectionDiff {
  added: string[];
  removed: string[];
  modified: DiffPair[];
  stats: SectionDiffStats;
}

/** Year-over-year Item 1A (risk factors) comparison between two 10-Ks. */
export interface RiskFactorsDiff {
  ticker: string;
  cik: string;
  current: FilingRef;
  previous: FilingRef;
  diff: SectionDiff;
}

// ── Financials (XBRL) ──────────────────────────────────────────────────────

/** One XBRL fact: a value for a concept in a specific period. */
export interface MetricValue {
  value: number;
  /** Unit of measure: `USD`, `USD/shares`, `shares`, `pure`, … */
  unit: string;
  period_start?: string;
  period_end?: string;
  fiscal_year?: number;
  /** `FY`, `Q1`, `Q2`, … */
  fiscal_period?: string;
  form?: string;
  accession?: string;
  filed_at?: string;
}

/** A concept and its full reported time series. */
export interface ConceptBlock {
  /** XBRL taxonomy, e.g. `us-gaap`, `ifrs-full`. */
  taxonomy: string;
  concept: string;
  label?: string;
  description?: string;
  series: MetricValue[];
}

/** Full XBRL bundle for a company (gzip-required endpoint). */
export interface Financials {
  ticker: string;
  cik: string;
  name: string;
  concepts: ConceptBlock[];
}

/** A single concept's time series for a company (gzip-required endpoint). */
export interface FinancialConcept {
  ticker: string;
  cik: string;
  taxonomy: string;
  concept: string;
  label?: string;
  description?: string;
  series: MetricValue[];
}

/** Cross-sectional screener: one concept/period across many companies. */
export interface ScreenerRow {
  cik: string;
  name: string;
  value: number;
  unit: string;
  period_end: string;
  accession: string;
}

export interface ScreenerResult {
  taxonomy: string;
  concept: string;
  period: string;
  unit: string;
  label?: string;
  rows: ScreenerRow[];
  meta: { next_cursor?: string; as_of: string; total?: number };
}

// ── Ratios ─────────────────────────────────────────────────────────────────

/** Fundamental ratios for one fiscal period; ratio fields omitted when not computable. */
export interface FinancialRatio {
  fiscal_year: number;
  fiscal_period: string;
  period_end: string;
  form: string;
  accession: string;
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  return_on_equity?: number;
  return_on_assets?: number;
  debt_to_equity?: number;
  current_ratio?: number;
  quick_ratio?: number;
  asset_turnover?: number;
  free_cash_flow?: number;
  fcf_margin?: number;
}

export interface Ratios {
  ticker: string;
  cik: string;
  /** Most recent period, when available. */
  latest?: FinancialRatio;
  /** All periods, newest first. */
  history: FinancialRatio[];
}

// ── Event / ownership / compensation / insider filings ───────────────────────

/** 8-K material event or earnings release filing. */
export interface EventFiling {
  accession: string;
  filed_at: string;
  accepted_at?: string;
  /** 8-K item codes, e.g. `["2.02", "5.02"]`. */
  items: string[];
  primary_document_url?: string;
  description?: string;
}

/** Schedule 13D/13G beneficial-ownership filing. */
export interface OwnershipFiling {
  /** `SC 13D`, `SC 13D/A`, `SC 13G`, `SC 13G/A`. */
  form: string;
  accession: string;
  filed_at: string;
  primary_document_url?: string;
  description?: string;
}

/** DEF 14A proxy/compensation filing. */
export interface CompensationFiling {
  /** `DEF 14A`, `DEFA14A`, `DEF 14A/A`. */
  form: string;
  accession: string;
  filed_at: string;
  period_end?: string;
  primary_document_url?: string;
}

/** A Form 3/4/5 insider transaction. */
export interface InsiderTransaction {
  accession: string;
  filed_at: string;
  reporter: string;
  reporter_cik: string;
  /** `["director", "officer", "ten_percent_owner", "other"]`. */
  roles: string[];
  officer_title?: string;
  security: string;
  transaction_date: string;
  /** Form 4 transaction code: `P` purchase, `S` sale, … */
  transaction_code: string;
  transaction_description: string;
  /** `buy` or `sell`. */
  direction: string;
  shares: number;
  price_per_share?: number;
  /** shares × price. */
  notional_usd?: number;
  shares_owned_after: number;
  /** `direct` or `indirect`. */
  ownership: string;
  derivative: boolean;
}

// ── Historical bars ──────────────────────────────────────────────────────────

/** One OHLCV bar. `t` is the bar's OPEN time in Unix epoch milliseconds. */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BarsMeta {
  as_of: string;
  next_cursor?: string;
  symbol: string;
  /** Observed interval (may differ from requested for some venues). */
  interval: string;
}

export interface BarsResponse {
  data: Bar[];
  meta: BarsMeta;
}

// ── Params ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  /** Search string: ticker, company name, or CIK substring. Required. */
  q: string;
  /** Max results, default 25, max 100. */
  limit?: number;
}

export interface FilingsParams extends PageParams {
  /** Comma-separated exact form types, e.g. `"10-K,10-Q"`. */
  form?: string;
  /** Lower bound on `filed_at`, `YYYY-MM-DD`. */
  from?: string;
  /** Upper bound on `filed_at`, `YYYY-MM-DD`. */
  to?: string;
}

export interface EventsParams extends PageParams {
  /** Filter by 8-K item code, e.g. `"2.02"`. */
  item?: string;
}

export interface ScreenerParams extends PageParams {
  /** Concept namespace. Default `us-gaap`. */
  taxonomy?: string;
  /** Unit filter. Default `USD`. */
  unit?: string;
}

export interface StockBarsParams extends PageParams {
  /** Inclusive lower bound: `YYYY-MM-DD` (NYSE local) or RFC3339 (UTC). */
  start?: string;
  /** Inclusive upper bound. Default: now. */
  end?: string;
  /** `1m` | `5m` | `15m` | `30m` | `1h`. Default `1m`. */
  interval?: BarInterval;
}

/**
 * `/v1/fnd/stocks/*` plus `/v1/hist/stocks/*` — everything keyed by a US
 * equity ticker: profile, filings, sections, financials, ratios, insiders,
 * ownership, events, compensation, the cross-sectional screener, and OHLCV bars.
 *
 * Methods returning {@link ListResponse} are cursor-paginated; pair them with
 * `autoPaginate`/`collectAll` from the package root to stream every page.
 */
export class StocksResource {
  constructor(private readonly http: HttpClient) {}

  /** Ticker/company lookup. `GET /v1/fnd/stocks/search`. */
  search(params: SearchParams): Promise<ListResponse<StockSearchResult> & { meta: { as_of: string } }> {
    return this.http.get(`/v1/fnd/stocks/search`, {
      query: { q: params.q, limit: params.limit },
    });
  }

  /** Company profile. `GET /v1/fnd/stocks/:ticker/profile`. */
  profile(ticker: string): Promise<CompanyProfile> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/profile`);
  }

  /** Paginated SEC filings list. `GET /v1/fnd/stocks/:ticker/filings`. */
  filings(ticker: string, params: FilingsParams = {}): Promise<ListResponse<Filing>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/filings`, {
      query: { ...params },
    });
  }

  /** Single filing detail. `GET /v1/fnd/stocks/:ticker/filings/:accession`. */
  filing(ticker: string, accession: string): Promise<FilingDetail> {
    return this.http.get(
      `/v1/fnd/stocks/${enc(ticker)}/filings/${enc(accession)}`,
    );
  }

  /** All extracted text sections of a filing. `GET /v1/fnd/stocks/:ticker/filings/:accession/sections`. */
  sections(ticker: string, accession: string): Promise<FilingSections> {
    return this.http.get(
      `/v1/fnd/stocks/${enc(ticker)}/filings/${enc(accession)}/sections`,
    );
  }

  /** One extracted section's full text. `GET /v1/fnd/stocks/:ticker/filings/:accession/sections/:section`. */
  section(
    ticker: string,
    accession: string,
    section: FilingSectionCode,
  ): Promise<FilingSectionDetail> {
    return this.http.get(
      `/v1/fnd/stocks/${enc(ticker)}/filings/${enc(accession)}/sections/${enc(section)}`,
    );
  }

  /** Year-over-year risk-factor (Item 1A) diff. `GET /v1/fnd/stocks/:ticker/risk-factors-diff`. */
  riskFactorsDiff(ticker: string): Promise<RiskFactorsDiff> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/risk-factors-diff`);
  }

  /** Fundamental ratios (latest + history). `GET /v1/fnd/stocks/:ticker/ratios`. */
  ratios(ticker: string): Promise<Ratios> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/ratios`);
  }

  /** Earnings-release history (8-K item 2.02). `GET /v1/fnd/stocks/:ticker/earnings`. */
  earnings(ticker: string, params: PageParams = {}): Promise<ListResponse<EventFiling>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/earnings`, {
      query: { ...params },
    });
  }

  /** Full XBRL financials bundle. Requires gzip (handled automatically). `GET /v1/fnd/stocks/:ticker/financials`. */
  financials(ticker: string): Promise<Financials> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/financials`);
  }

  /**
   * One XBRL concept across all periods. Requires gzip (handled automatically).
   * `GET /v1/fnd/stocks/:ticker/financials/:concept`.
   */
  financialConcept(
    ticker: string,
    concept: string,
    params: { taxonomy?: string } = {},
  ): Promise<FinancialConcept> {
    return this.http.get(
      `/v1/fnd/stocks/${enc(ticker)}/financials/${enc(concept)}`,
      { query: { taxonomy: params.taxonomy } },
    );
  }

  /** Form 3/4/5 insider transactions. `GET /v1/fnd/stocks/:ticker/insiders` (limit default 10, max 25). */
  insiders(
    ticker: string,
    params: PageParams = {},
  ): Promise<ListResponse<InsiderTransaction>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/insiders`, {
      query: { ...params },
    });
  }

  /** Schedule 13D/13G ownership filings. `GET /v1/fnd/stocks/:ticker/ownership`. */
  ownership(
    ticker: string,
    params: PageParams = {},
  ): Promise<ListResponse<OwnershipFiling>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/ownership`, {
      query: { ...params },
    });
  }

  /** 8-K material events. `GET /v1/fnd/stocks/:ticker/events`. */
  events(ticker: string, params: EventsParams = {}): Promise<ListResponse<EventFiling>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/events`, {
      query: { ...params },
    });
  }

  /** DEF 14A proxy/compensation filings. `GET /v1/fnd/stocks/:ticker/compensation`. */
  compensation(
    ticker: string,
    params: PageParams = {},
  ): Promise<ListResponse<CompensationFiling>> {
    return this.http.get(`/v1/fnd/stocks/${enc(ticker)}/compensation`, {
      query: { ...params },
    });
  }

  /**
   * Cross-sectional screener: one concept/period across all filers.
   * Requires gzip (handled automatically). `GET /v1/fnd/stocks/screener/:concept/:period`.
   */
  screener(
    concept: string,
    period: string,
    params: ScreenerParams = {},
  ): Promise<ScreenerResult> {
    return this.http.get(
      `/v1/fnd/stocks/screener/${enc(concept)}/${enc(period)}`,
      { query: { ...params } },
    );
  }

  /**
   * Historical OHLCV bars for a US equity. Requires gzip (handled automatically).
   * `GET /v1/hist/stocks/:ticker/bars`.
   */
  bars(ticker: string, params: StockBarsParams = {}): Promise<BarsResponse> {
    return this.http.get(`/v1/hist/stocks/${enc(ticker)}/bars`, {
      query: { ...params },
    });
  }
}

const enc = encodeURIComponent;
