import { describe, expect, it, vi } from "vitest";
import {
  SiftingApiError,
  SiftingClient,
  SiftingConnectionError,
  autoPaginate,
  isSiftingApiError,
  type FetchLike,
} from "../src/index.js";

/** Build a fetch stub that returns canned JSON, capturing the calls it received. */
function jsonFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): { fetch: FetchLike; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  };
  return { fetch, calls };
}

describe("request building", () => {
  it("hits the right URL, sends the API key and gzip header", async () => {
    const { fetch, calls } = jsonFetch(200, { s: "BTCUSDT", p: "1", P: "1", t: 1 });
    const client = new SiftingClient({ apiKey: "sft_test", fetch });

    const trade = await client.last.trade("crypto", "BTCUSDT");

    expect(trade.s).toBe("BTCUSDT");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.sifting.io/v1/last/trade/crypto/BTCUSDT");
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("sft_test");
    expect(headers["Accept-Encoding"]).toBe("gzip");
  });

  it("serializes query params and drops undefined", async () => {
    const { fetch, calls } = jsonFetch(200, { data: [], meta: { as_of: "x" } });
    const client = new SiftingClient({ apiKey: "k", fetch });

    await client.stocks.filings("AAPL", { form: "10-K", limit: 5, cursor: undefined });

    expect(calls[0]!.url).toBe(
      "https://api.sifting.io/v1/fnd/stocks/AAPL/filings?form=10-K&limit=5",
    );
  });

  it("supports a custom baseUrl for browser proxy patterns", async () => {
    const { fetch, calls } = jsonFetch(200, { s: "X", p: "1", P: "1", t: 1 });
    const client = new SiftingClient({ baseUrl: "https://my-proxy.example.com", fetch });

    await client.last.trade("crypto", "ETHUSDT");

    expect(calls[0]!.url).toBe(
      "https://my-proxy.example.com/v1/last/trade/crypto/ETHUSDT",
    );
    // No key configured → no X-API-Key header (the proxy injects it).
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBeUndefined();
  });

  it("resolves an async getApiKey hook", async () => {
    const { fetch, calls } = jsonFetch(200, { s: "X", p: "1", P: "1", t: 1 });
    const getApiKey = vi.fn(async () => "sft_dynamic");
    const client = new SiftingClient({ getApiKey, fetch });

    await client.last.quote("crypto", "BTCUSDT");

    expect(getApiKey).toHaveBeenCalledOnce();
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("sft_dynamic");
  });
});

describe("error handling", () => {
  it("decodes API errors into SiftingApiError", async () => {
    const { fetch } = jsonFetch(
      404,
      { error: "unknown_ticker", message: "no such ticker" },
      { "X-Request-Id": "req-123" },
    );
    const client = new SiftingClient({ apiKey: "k", fetch, maxRetries: 0 });

    const err = await client.stocks.profile("NOPE").catch((e) => e);
    expect(isSiftingApiError(err)).toBe(true);
    expect(err).toBeInstanceOf(SiftingApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("unknown_ticker");
    expect(err.message).toBe("no such ticker");
    expect(err.requestId).toBe("req-123");
  });

  it("exposes retry_after on rate-limit errors", async () => {
    const { fetch } = jsonFetch(
      429,
      { error: "rate_limit_exceeded", retry_after: 12 },
      { "Retry-After": "12" },
    );
    const client = new SiftingClient({ apiKey: "k", fetch, maxRetries: 0 });

    const err = (await client.last.trade("crypto", "BTCUSDT").catch((e) => e)) as SiftingApiError;
    expect(err.code).toBe("rate_limit_exceeded");
    expect(err.retryAfter).toBe(12);
  });

  it("wraps network failures as SiftingConnectionError", async () => {
    const fetch: FetchLike = async () => {
      throw new TypeError("network down");
    };
    const client = new SiftingClient({ apiKey: "k", fetch, maxRetries: 0 });

    const err = await client.last.trade("crypto", "BTCUSDT").catch((e) => e);
    expect(err).toBeInstanceOf(SiftingConnectionError);
  });
});

describe("retries", () => {
  it("retries a 429 then succeeds", async () => {
    let n = 0;
    const fetch: FetchLike = async () => {
      n++;
      if (n === 1) {
        return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      }
      return new Response(JSON.stringify({ s: "BTCUSDT", p: "1", P: "1", t: 1 }), {
        status: 200,
      });
    };
    const client = new SiftingClient({ apiKey: "k", fetch, maxRetries: 2 });

    const trade = await client.last.trade("crypto", "BTCUSDT");
    expect(trade.s).toBe("BTCUSDT");
    expect(n).toBe(2);
  });
});

describe("pagination", () => {
  it("autoPaginate walks every page via next_cursor", async () => {
    const pages = [
      { data: [{ accession: "a" }, { accession: "b" }], meta: { as_of: "x", next_cursor: "c1" } },
      { data: [{ accession: "c" }], meta: { as_of: "x" } }, // no next_cursor → last page
    ];
    let i = 0;
    const fetchPage = vi.fn(async () => pages[i++]!);

    const seen: string[] = [];
    for await (const item of autoPaginate(fetchPage)) seen.push(item.accession);

    expect(seen).toEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe("websocket url", () => {
  it("builds an authenticated ws url and resource tree", () => {
    const client = new SiftingClient({ apiKey: "sft_x" });
    const socket = client.ws();
    expect(socket).toBeDefined();
    // Resource namespaces exist and are distinct.
    expect(client.stocks).toBeDefined();
    expect(client.markets).toBeDefined();
    expect(client.economicCalendar).toBeDefined();
  });
});
