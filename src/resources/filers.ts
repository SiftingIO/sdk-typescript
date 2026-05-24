import type { HttpClient } from "../http.js";
import type { ListMeta, PageParams } from "../types.js";

/** One position in a 13F-HR institutional holdings filing. */
export interface HoldingPosition {
  issuer: string;
  security_type: string;
  /** 9-character CUSIP. */
  cusip: string;
  value_usd: number;
  shares: number;
  /** `SH` (shares), `PRN` (principal), … */
  shares_type: string;
  /** `SOLE`, `SHARED`, `NONE`. */
  discretion: string;
}

/** A 13F filer's latest reported holdings. `positions` is cursor-paginated via `meta`. */
export interface Holdings {
  /** 10-digit zero-padded CIK of the filer. */
  filer_cik: string;
  /** Resolved name when looked up by ticker; empty when queried by CIK. */
  filer_name?: string;
  accession: string;
  filed_at: string;
  period_end: string;
  total_value_usd: number;
  positions: HoldingPosition[];
  meta: ListMeta;
}

/** `/v1/fnd/filers/*` — 13F institutional holdings, keyed by filer ticker or CIK. */
export class FilersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Latest 13F-HR positions for an institutional filer.
   * `filer` accepts a CIK (numeric) or a ticker. `GET /v1/fnd/filers/:filer/holdings`.
   */
  holdings(filer: string, params: PageParams = {}): Promise<Holdings> {
    return this.http.get(`/v1/fnd/filers/${encodeURIComponent(filer)}/holdings`, {
      query: { ...params },
    });
  }
}
