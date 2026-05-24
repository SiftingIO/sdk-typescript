import {
  SiftingApiError,
  SiftingConnectionError,
  type SiftingErrorBody,
} from "./errors.js";

/** A subset of the `fetch` signature, so any compatible polyfill can be injected. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** Options accepted by {@link SiftingClient}; the transport reads the subset it needs. */
export interface SiftingClientOptions {
  /**
   * Your `sft_…` API key. Sent as the `X-API-Key` header.
   *
   * Server-side only for production: any key shipped in browser JavaScript is
   * publicly visible. For browser apps, prefer routing through your own backend
   * via {@link baseUrl} + {@link fetch}, or supply short-lived keys via {@link getApiKey}.
   */
  apiKey?: string;
  /**
   * Async hook that returns the API key per-request. Takes precedence over
   * {@link apiKey}. Useful for refreshing short-lived/scoped keys.
   */
  getApiKey?: () => string | Promise<string>;
  /** Base URL (no trailing `/v1`). Default: `https://api.sifting.io`. */
  baseUrl?: string;
  /** WebSocket URL. Default: `wss://stream.sifting.io/ws/v1`. */
  wsUrl?: string;
  /** Custom fetch implementation (proxy, instrumentation, tests). Defaults to global `fetch`. */
  fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Default: 30000. Set 0 to disable. */
  timeout?: number;
  /** Max automatic retries for 429 and 5xx responses. Default: 2. */
  maxRetries?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
}

/** A query value; `undefined`/`null` entries are dropped, arrays are comma-joined. */
export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

export interface RequestOptions {
  /** Query string params. Undefined/null are omitted. */
  query?: Record<string, QueryValue>;
  /** Per-call AbortSignal, combined with the configured timeout. */
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = "https://api.sifting.io";
const DEFAULT_WS_URL = "wss://stream.sifting.io/ws/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * Internal HTTP transport. One instance per client; resources call `get()`.
 * Handles auth, query building, gzip negotiation, timeouts, retries with
 * backoff, and error decoding.
 */
export class HttpClient {
  readonly baseUrl: string;
  readonly wsUrl: string;
  private readonly apiKey?: string;
  private readonly getApiKey?: () => string | Promise<string>;
  private readonly fetchImpl: FetchLike;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(opts: SiftingClientOptions) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.wsUrl = opts.wsUrl ?? DEFAULT_WS_URL;
    this.apiKey = opts.apiKey;
    this.getApiKey = opts.getApiKey;
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.extraHeaders = opts.headers ?? {};

    const f = opts.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error(
        "No fetch implementation found. Use Node 18+, or pass `fetch` in the client options.",
      );
    }
    // Bind to globalThis to avoid "Illegal invocation" in browsers.
    this.fetchImpl = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** Resolve the API key for this request (async hook wins over static key). */
  private async resolveKey(): Promise<string | undefined> {
    if (this.getApiKey) return await this.getApiKey();
    return this.apiKey;
  }

  /** Perform a GET and parse JSON into `T`. Path is relative to the host, e.g. `/v1/last/...`. */
  async get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.baseUrl + path + buildQuery(opts.query);
    const key = await this.resolveKey();

    const headers: Record<string, string> = {
      Accept: "application/json",
      // Six endpoints (screener, financials[/concept], hist bars) 406 without
      // this; sending it everywhere is harmless and enables compression.
      // Browsers ignore attempts to set Accept-Encoding but send it anyway.
      "Accept-Encoding": "gzip",
      ...this.extraHeaders,
    };
    if (key) headers["X-API-Key"] = key;

    let attempt = 0;
    // Total tries = maxRetries + 1.
    for (;;) {
      const { signal, clear } = this.makeSignal(opts.signal);
      let res: Response;
      try {
        res = await this.fetchImpl(url, { method: "GET", headers, signal });
      } catch (err) {
        clear();
        const aborted = isAbortError(err);
        // A timeout/network blip is retryable; an upstream-caller abort is not.
        if (aborted && opts.signal?.aborted) {
          throw new SiftingConnectionError("Request aborted by caller.", { cause: err });
        }
        if (attempt < this.maxRetries) {
          attempt++;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new SiftingConnectionError(
          aborted ? `Request timed out after ${this.timeout}ms.` : "Network request failed.",
          { cause: err, timeout: aborted },
        );
      }
      clear();

      if (res.ok) {
        return (await res.json()) as T;
      }

      // Retry 429 and 5xx (except 501) while attempts remain.
      const retryable = res.status === 429 || (res.status >= 500 && res.status !== 501);
      if (retryable && attempt < this.maxRetries) {
        attempt++;
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        await sleep(retryAfter != null ? retryAfter * 1000 : backoffMs(attempt));
        continue;
      }

      throw await decodeError(res);
    }
  }

  /** Build the authenticated WebSocket URL (key in query — the only WS auth the API accepts). */
  async wsConnectUrl(): Promise<string> {
    const key = await this.resolveKey();
    if (!key) return this.wsUrl;
    const sep = this.wsUrl.includes("?") ? "&" : "?";
    return `${this.wsUrl}${sep}key=${encodeURIComponent(key)}`;
  }

  /** Combine the configured timeout with an optional caller signal into one AbortSignal. */
  private makeSignal(caller?: AbortSignal): { signal?: AbortSignal; clear: () => void } {
    if (this.timeout <= 0 && !caller) return { signal: undefined, clear: () => {} };

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (caller) {
      if (caller.aborted) controller.abort();
      else caller.addEventListener("abort", onAbort, { once: true });
    }
    const timer =
      this.timeout > 0 ? setTimeout(() => controller.abort(), this.timeout) : undefined;

    return {
      signal: controller.signal,
      clear: () => {
        if (timer) clearTimeout(timer);
        caller?.removeEventListener("abort", onAbort);
      },
    };
  }
}

/** Serialize a query object to a `?a=1&b=2` string, dropping nullish values. */
function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const encoded = Array.isArray(value) ? value.join(",") : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Turn a non-2xx Response into a {@link SiftingApiError}, tolerating non-JSON bodies. */
async function decodeError(res: Response): Promise<SiftingApiError> {
  let body: SiftingErrorBody | undefined;
  let code = `http_${res.status}`;
  let message = `Request failed with status ${res.status}`;

  try {
    const parsed = (await res.json()) as SiftingErrorBody;
    if (parsed && typeof parsed === "object") {
      body = parsed;
      if (typeof parsed.error === "string") code = parsed.error;
      if (typeof parsed.message === "string") message = parsed.message;
      else if (typeof parsed.error === "string") message = parsed.error;
    }
  } catch {
    // Non-JSON error body (e.g. an ALB/gateway HTML page). Keep defaults.
  }

  const retryAfter =
    parseRetryAfter(res.headers.get("Retry-After")) ??
    (typeof body?.retry_after === "number" ? body.retry_after : undefined) ??
    (typeof body?.retry_after_seconds === "number" ? body.retry_after_seconds : undefined);

  return new SiftingApiError({
    status: res.status,
    code,
    message,
    requestId: res.headers.get("X-Request-Id") ?? undefined,
    retryAfter,
    body,
  });
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  return Number.isFinite(n) ? n : undefined;
}

/** Exponential backoff with full jitter, capped at 10s. */
function backoffMs(attempt: number): number {
  const base = Math.min(10_000, 200 * 2 ** (attempt - 1));
  return Math.random() * base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
  );
}
