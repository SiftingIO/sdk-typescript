# @siftingio/sdk

Official TypeScript SDK for the [SiftingIO](https://sifting.io) market data API — REST + live WebSocket, in one isomorphic package.

- **Typed end to end.** Every endpoint, parameter, and response is a TypeScript type.
- **Runs everywhere.** Node 18+, Bun, Deno, edge runtimes, and browsers. Zero required runtime dependencies (native `fetch` / `WebSocket`).
- **Resource-mapped.** Method names mirror the [API docs](https://sifting.io/docs) 1:1, so the docs *are* the SDK reference.
- **Batteries included.** Auto-retry on 429/5xx, gzip negotiation, cursor auto-pagination, and an auto-reconnecting WebSocket client.

## Install

```bash
npm install @siftingio/sdk
# pnpm add @siftingio/sdk · yarn add @siftingio/sdk · bun add @siftingio/sdk
```

For live WebSocket data **in Node**, also install `ws` (browsers/Deno/Bun use the built-in `WebSocket`):

```bash
npm install ws
```

## Quick start

```ts
import { SiftingClient } from "@siftingio/sdk";

const sifting = new SiftingClient({ apiKey: process.env.SIFTING_API_KEY });

// Live price
const trade = await sifting.last.trade("crypto", "BTCUSDT");
console.log(trade.p, trade.t);

// Company fundamentals
const profile = await sifting.stocks.profile("AAPL");
const ratios = await sifting.stocks.ratios("AAPL");

// Historical bars (gzip handled for you)
const { data: bars } = await sifting.crypto.bars("BTCUSD", {
  start: "2024-01-01",
  interval: "1h",
});
```

## Authentication & the browser

Get an API key from your [SiftingIO dashboard](https://sifting.io). It's sent as the `X-API-Key` header.

> **Never embed a production key in browser JavaScript** — anything shipped to the browser is publicly readable. For browser/edge apps, route requests through your own backend:

```ts
// Browser: no key here — your server injects it.
const sifting = new SiftingClient({
  baseUrl: "https://your-app.com/api/sifting-proxy",
});
```

Or supply short-lived/scoped keys per request via the `getApiKey` hook:

```ts
const sifting = new SiftingClient({
  getApiKey: async () => (await fetch("/token").then((r) => r.json())).key,
});
```

## Configuration

```ts
new SiftingClient({
  apiKey: "sft_…",        // X-API-Key header
  getApiKey: async () => "sft_…", // async alternative to apiKey
  baseUrl: "https://api.sifting.io",        // override for proxies/staging
  wsUrl: "wss://stream.sifting.io/ws/v1",   // WebSocket endpoint
  fetch: customFetch,     // inject a fetch impl (proxy, instrumentation, tests)
  timeout: 30_000,        // per-request timeout (ms); 0 disables
  maxRetries: 2,          // automatic retries for 429 / 5xx
  headers: { "X-Trace": "…" }, // extra headers on every request
});
```

## Resources

Each namespace maps to a section of the API. Full parameter and field types are available via your editor's autocomplete.

| Namespace | Endpoints | Highlights |
|---|---|---|
| `sifting.last` | `/v1/last/*` | `trade`, `quote`, `tvl` — live snapshots |
| `sifting.stocks` | `/v1/fnd/stocks/*`, `/v1/hist/stocks/*` | `search`, `profile`, `filings`, `financials`, `ratios`, `insiders`, `events`, `screener`, `bars`, … |
| `sifting.filers` | `/v1/fnd/filers/*` | `holdings` — 13F positions |
| `sifting.markets` | `/v1/fnd/markets/*` | `list`, `status`, `hours`, `calendar` |
| `sifting.forex` | `/v1/hist/forex/*` | `bars` |
| `sifting.crypto` | `/v1/hist/crypto/*` | `bars` |
| `sifting.dex` | `/v1/fnd/dex/*` | `wallet` portfolios |
| `sifting.economicCalendar` | `/v1/fnd/economic-calendar` | `list` |

## Pagination

List endpoints return `{ data, meta }` with an opaque `meta.next_cursor`. Use `autoPaginate` to stream every page, or `collectAll` to gather them:

```ts
import { autoPaginate, collectAll } from "@siftingio/sdk";

// Stream — memory-friendly
for await (const filing of autoPaginate((cursor) =>
  sifting.stocks.filings("AAPL", { cursor, form: "10-K" }),
)) {
  console.log(filing.accession, filing.filed_at);
}

// Or collect (with an optional cap)
const insiders = await collectAll(
  (cursor) => sifting.stocks.insiders("TSLA", { cursor }),
  100,
);
```

## Live WebSocket

```ts
const socket = sifting.ws(); // { autoReconnect, heartbeatInterval, ... }

socket.on("tick", (t) => console.log(t.s, t.p ?? `${t.b}/${t.a}`));
socket.on("tvl", (v) => console.log(v.s, v.usd));
socket.on("error", (e) => console.error("server error:", e.code, e.message));
socket.on("reconnect", ({ attempt }) => console.log("reconnecting", attempt));

await socket.connect();
socket.subscribe("cex", ["BTCUSDT", "ETHUSDT"]); // products: cex | dex | fx | us | tvl
socket.subscribe("tvl", ["eth:WETH-USDC"]);

// later…
socket.unsubscribe("cex", ["ETHUSDT"]);
socket.close();
```

Subscriptions are tracked and **replayed automatically on reconnect**, so you subscribe once and keep receiving data across network drops. Calling `subscribe()` before `connect()` is fine — it's queued and sent on open.

## Error handling

Every failure is a typed subclass of `SiftingError`:

```ts
import { SiftingApiError, SiftingConnectionError } from "@siftingio/sdk";

try {
  await sifting.stocks.profile("NOPE");
} catch (err) {
  if (err instanceof SiftingApiError) {
    err.status;     // 404
    err.code;       // "unknown_ticker"
    err.retryAfter; // seconds, on 429
    err.requestId;  // X-Request-Id — quote this in support tickets
  } else if (err instanceof SiftingConnectionError) {
    err.timeout;    // true if it was a client-side timeout
  }
}
```

The client automatically retries `429` and `5xx` responses up to `maxRetries`, honoring `Retry-After`.

## Compatibility

| Target | REST | WebSocket |
|---|---|---|
| Node 18+ | ✅ native `fetch` | ✅ via `ws` (install separately) |
| Bun / Deno | ✅ | ✅ built-in `WebSocket` |
| Browser / edge | ✅ (proxy your key) | ✅ built-in `WebSocket` |

## License

MIT
