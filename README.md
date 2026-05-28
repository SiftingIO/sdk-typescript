# SiftingIO TypeScript SDK

Official TypeScript SDK for the [SiftingIO Market Data API](https://sifting.io).

SiftingIO provides real-time and historical market data APIs for stocks, FX, crypto, commodities, DEX, and on-chain markets through REST and WebSocket.

This SDK is built for JavaScript and TypeScript developers integrating market data into financial applications, trading tools, dashboards, research platforms, web apps, edge services, and enterprise data workflows.

## Highlights

* **Typed end to end** with TypeScript types for endpoint parameters, request options, and response shapes.
* **REST and WebSocket support** in one isomorphic package.
* **Runs across runtimes** including Node 18+, Bun, Deno, edge runtimes, and browsers.
* **Native runtime APIs** using `fetch` and `WebSocket` where available.
* **Resource-mapped API design** with method names that mirror the [SiftingIO API documentation](https://sifting.io/docs).
* **Production-oriented defaults** including retry handling for `429` and `5xx`, gzip negotiation, cursor auto-pagination, and an auto-reconnecting WebSocket client.

## Resources

* [Website](https://sifting.io)
* [API Documentation](https://sifting.io/docs)
* [Postman Collection](https://www.postman.com/siftingio/siftingio-market-data-api)
* [Pricing](https://sifting.io/pricing)
* [System Status](https://siftingio.instatus.com/)

## Install

```bash
npm install @siftingio/sdk
```

Alternative package managers:

```bash
pnpm add @siftingio/sdk
yarn add @siftingio/sdk
bun add @siftingio/sdk
```

For live WebSocket data in Node.js, install `ws`:

```bash
npm install ws
```

Browsers, Deno, and Bun use the built-in `WebSocket`.

## Quick start

```ts
import { SiftingClient } from "@siftingio/sdk";

const sifting = new SiftingClient({
  apiKey: process.env.SIFTING_API_KEY,
});

// Live price snapshot
const trade = await sifting.last.trade("crypto", "BTCUSD");
console.log(trade.p, trade.t);

// Company fundamentals
const profile = await sifting.stocks.profile("AAPL");
const ratios = await sifting.stocks.ratios("AAPL");

// Historical bars
const { data: bars } = await sifting.crypto.bars("BTCUSD", {
  start: "2024-01-01",
  interval: "1h",
});

console.log(bars.length, "bars");
```

## Authentication

Create an API key from the [SiftingIO dashboard](https://sifting.io). The SDK sends it as the `X-API-Key` header.

```ts
import { SiftingClient } from "@siftingio/sdk";

const sifting = new SiftingClient({
  apiKey: "sft_...",
});
```

You can also provide the API key dynamically:

```ts
const sifting = new SiftingClient({
  getApiKey: async () => {
    const response = await fetch("/token");
    const data = await response.json();
    return data.key;
  },
});
```

## Browser and edge usage

Never embed a production API key in browser JavaScript. Anything shipped to the browser can be read by users.

For browser or edge applications, route requests through your own backend or a secure proxy:

```ts
const sifting = new SiftingClient({
  baseUrl: "https://your-app.com/api/sifting-proxy",
});
```

This keeps your production key outside the browser while preserving the same SDK interface.

## Configuration

```ts
import { SiftingClient } from "@siftingio/sdk";

const sifting = new SiftingClient({
  apiKey: "sft_...",                         // X-API-Key header
  getApiKey: async () => "sft_...",          // async alternative to apiKey
  baseUrl: "https://api.sifting.io",         // override for proxies or staging
  wsUrl: "wss://stream.sifting.io/ws/v1",    // WebSocket endpoint
  fetch: customFetch,                        // custom fetch implementation
  timeout: 30_000,                           // per-request timeout in ms; 0 disables
  maxRetries: 2,                             // automatic retries for 429 and 5xx
  headers: { "X-Trace": "..." },             // extra headers on every request
});
```

## API resources

Each namespace maps to a section of the SiftingIO API. Full parameter and field types are available through editor autocomplete.

| Namespace                  | Endpoints                               | Highlights                                                                                                 |
| -------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `sifting.last`             | `/v1/last/*`                            | `trade`, `quote`, `tvl` live snapshots                                                                     |
| `sifting.stocks`           | `/v1/fnd/stocks/*`, `/v1/hist/stocks/*` | `search`, `profile`, `filings`, `financials`, `ratios`, `insiders`, `events`, `screener`, `bars`, and more |
| `sifting.filers`           | `/v1/fnd/filers/*`                      | `holdings` for 13F positions                                                                               |
| `sifting.markets`          | `/v1/fnd/markets/*`                     | `list`, `status`, `hours`, `calendar`                                                                      |
| `sifting.forex`            | `/v1/hist/forex/*`                      | Historical FX bars                                                                                         |
| `sifting.crypto`           | `/v1/hist/crypto/*`                     | Historical crypto bars                                                                                     |
| `sifting.dex`              | `/v1/fnd/dex/*`                         | Wallet and DEX-related data                                                                                |
| `sifting.economicCalendar` | `/v1/fnd/economic-calendar`             | Economic calendar events                                                                                   |

## Pagination

List endpoints return `{ data, meta }` with an opaque `meta.next_cursor`.

Use `autoPaginate` to stream every page, or `collectAll` to collect paginated results into an array.

```ts
import { autoPaginate, collectAll } from "@siftingio/sdk";

// Stream results page by page
for await (const filing of autoPaginate((cursor) =>
  sifting.stocks.filings("AAPL", {
    cursor,
    form: "10-K",
  }),
)) {
  console.log(filing.accession, filing.filed_at);
}

// Collect results with an optional limit
const insiders = await collectAll(
  (cursor) =>
    sifting.stocks.insiders("TSLA", {
      cursor,
    }),
  100,
);
```

## Live WebSocket

```ts
const socket = sifting.ws();

socket.on("tick", (tick) => {
  console.log(tick.s, tick.p ?? `${tick.b}/${tick.a}`);
});

socket.on("tvl", (value) => {
  console.log(value.s, value.usd);
});

socket.on("error", (error) => {
  console.error("server error:", error.code, error.message);
});

socket.on("reconnect", ({ attempt }) => {
  console.log("reconnecting", attempt);
});

await socket.connect();

socket.subscribe("cex", ["BTCUSD", "ETHUSD"]); // cex, dex, fx, us, tvl
socket.subscribe("tvl", ["eth:WETH-USDC"]);

// Later
socket.unsubscribe("cex", ["ETHUSD"]);
socket.close();
```

Subscriptions are tracked and replayed automatically after reconnects.

Calling `subscribe()` before `connect()` is supported. Subscriptions are queued and sent when the socket opens.

## Error handling

Every failure is a typed subclass of `SiftingError`.

```ts
import {
  SiftingApiError,
  SiftingConnectionError,
} from "@siftingio/sdk";

try {
  await sifting.stocks.profile("NOPE");
} catch (err) {
  if (err instanceof SiftingApiError) {
    err.status;     // HTTP status code
    err.code;       // API error code
    err.retryAfter; // retry delay in seconds, when available
    err.requestId;  // X-Request-Id for support
  } else if (err instanceof SiftingConnectionError) {
    err.timeout;    // true for client-side timeout
  }
}
```

The client automatically retries `429` and `5xx` responses up to `maxRetries`, honoring `Retry-After` when available.

## Compatibility

| Target        | REST                     | WebSocket         |
| ------------- | ------------------------ | ----------------- |
| Node 18+      | Native `fetch`           | Via `ws`          |
| Bun           | Built-in                 | Built-in          |
| Deno          | Built-in                 | Built-in          |
| Browser       | Built-in, proxy your key | Built-in          |
| Edge runtimes | Built-in, proxy your key | Runtime-dependent |

## License

MIT
