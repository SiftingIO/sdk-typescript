/**
 * Error types thrown by the SDK.
 *
 * Everything thrown by the SDK extends {@link SiftingError}, so a single
 * `catch (err) { if (err instanceof SiftingError) ... }` covers all cases.
 * For HTTP-level failures the API returns `{ "error": "<code>", "message": "..." }`;
 * that `error` string is surfaced as {@link SiftingApiError.code}.
 */

/** Shape of the JSON body the API returns on a non-2xx response. */
export interface SiftingErrorBody {
  /** Machine-readable error code, e.g. `"unauthorized"`, `"rate_limit_exceeded"`. */
  error: string;
  /** Optional human-readable detail. */
  message?: string;
  /** Some errors carry extra fields (e.g. `retry_after`, `earliest`, `hint`). */
  [key: string]: unknown;
}

/** Base class for every error the SDK throws. */
export class SiftingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API responds with a non-2xx status. Inspect {@link code}
 * for the machine-readable reason and {@link status} for the HTTP status.
 */
export class SiftingApiError extends SiftingError {
  /** HTTP status code (e.g. 401, 404, 429). */
  readonly status: number;
  /** Machine-readable code from the response body's `error` field. */
  readonly code: string;
  /** `X-Request-Id` response header, if present — quote it in support tickets. */
  readonly requestId?: string;
  /** Seconds to wait before retrying, parsed from `Retry-After` (429 only). */
  readonly retryAfter?: number;
  /** The full parsed error body, including any non-standard fields. */
  readonly body?: SiftingErrorBody;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    retryAfter?: number;
    body?: SiftingErrorBody;
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.retryAfter = args.retryAfter;
    this.body = args.body;
  }
}

/** Thrown when the request never produced an HTTP response (network down, timeout, abort). */
export class SiftingConnectionError extends SiftingError {
  /** The underlying cause (e.g. a `TypeError` from fetch, or an `AbortError`). */
  readonly cause?: unknown;
  /** True when the failure was a client-side timeout. */
  readonly timeout: boolean;

  constructor(message: string, opts: { cause?: unknown; timeout?: boolean } = {}) {
    super(message);
    this.cause = opts.cause;
    this.timeout = opts.timeout ?? false;
  }
}

/** Type guard for {@link SiftingApiError}. */
export function isSiftingApiError(err: unknown): err is SiftingApiError {
  return err instanceof SiftingApiError;
}
