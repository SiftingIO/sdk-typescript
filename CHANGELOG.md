# Changelog

All notable changes to `@siftingio/sdk` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com); the project adheres to SemVer.

## [0.1.0] — Unreleased

Initial release.

### Added
- `SiftingClient` covering the full data plane: `last`, `stocks`, `filers`,
  `markets`, `forex`, `crypto`, `dex`, `economicCalendar`.
- Auto-reconnecting, typed WebSocket client (`client.ws()`) for `cex`, `dex`,
  `fx`, `us`, and `tvl` products with subscription replay on reconnect.
- Cursor auto-pagination helpers: `autoPaginate`, `collectAll`.
- Automatic retries (429/5xx with `Retry-After`), gzip negotiation, per-request
  timeouts, and typed errors (`SiftingApiError`, `SiftingConnectionError`).
- Isomorphic build (ESM + CJS + `.d.ts`); Node 18+, Bun, Deno, browser/edge.
- Browser-safe key handling via `baseUrl` proxying and the `getApiKey` hook.
