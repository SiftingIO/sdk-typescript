# Historical market data in automation workflows

These SiftingIO-maintained client examples read **one bounded page** of historical Forex or commodity bars. They are examples under development, not claims of official marketplace approval or a tested installation in every host platform.

The same response can support a dated research extract, an internal review table or a CSV handoff. A current quote, a historical bar and the time an API responds are different things; these examples retain the bar timestamps and pagination metadata rather than treating any successful response as a complete history.

## Files and validation

| Example | Entry point | Validation completed |
|---|---|---|
| Pipedream | `pipedream/historical-bars.mjs` | Action definition and run method tested with a platform stub and synthetic response; not deployed to a Pipedream workspace |
| Windmill | `windmill/standalone.ts` | TypeScript compilation and callable function tested with synthetic response; not published to Hub |
| Activepieces | `activepieces/index.ts` | Compiled against pieces-framework 0.32.0; action invoked using its current `auth.secret_text` shape and synthetic response; not imported into a running server |
| Node-RED | `node-red/` | Node registration/input handler tested with a RED stub; no native editor/runtime import test or npm publication yet |
| Grafana / Infinity | `grafana/historical-bars.json` | JSON and credential/refresh checks only; native import and rendering still required |

No existing customer key or market-data record is included. Automated tests use clearly synthetic prices. A local HTTP fixture verifies Node fetch's handling of a real gzip-compressed response. These checks do not constitute a successful authenticated call to the live SiftingIO API.

## Common request contract

| Setting | Value |
|---|---|
| Origin | `https://api.sifting.io` |
| Forex route | `GET /v1/hist/forex/{pair}/bars` |
| Commodity route | `GET /v1/hist/commodities/{symbol}/bars` |
| Authentication | `X-API-Key` header, supplied by the user |
| Encoding | `Accept-Encoding: gzip` is required by historical endpoints |
| Time window | Explicit inclusive `start` and `end`, using UTC dates or timestamps |
| Row bound | Default 300 per example request; maximum 2,000 |
| Paging | Return `meta.next_cursor`; no automatic pagination or retry loop |

Use the instrument catalog and account coverage to choose a real symbol and period. EURUSD is a Forex example; XAUUSD is a commodity example. The API key belongs in the host's secret/connection facility, never in a URL, source file, exported dashboard or example flow. Requests use your account's allowance. Access, retention, display and redistribution remain subject to your data licence; the source-code licence does not license the data.

The returned `t` is Unix time in **milliseconds**. OHLC values are checked for finite numbers and consistent ranges. Missing `v` remains missing. Forex `v` is a reported tick count, not exchange-traded volume. Do not combine instruments without checking their quote conventions and units.

An empty page is returned as an empty page. `has_more: true` means another cursor exists; it does not certify the requested period is complete. Errors expose the HTTP status and bounded guidance, without forwarding upstream bodies or the key. HTTP 422 can indicate an unavailable period. HTTP 429 needs account/rate-limit review before another request.

## Build and checks

Requires Node.js 22 (the version used for these checks), pnpm and Python 3 for generating self-contained files. The Node-RED package itself targets Node.js 20+ for built-in fetch.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
```

`generate.py` makes no network calls. It creates the standalone scripts and exported JSON from the reviewed client. Do not edit generated files without updating the generator.

## Host setup before a real run

**Pipedream:** Import the action into a development workspace. Enter your own key in its secret prop and choose a short period within account coverage. Verify both a successful response and an invalid-key error. A named app/connection is a separate registry process; this code does not register one.

**Windmill:** Use `windmill/standalone.ts` as a TypeScript script. Bind `api_key` to a secret variable reference in the workspace. Check the run settings so argument values containing credentials are not exposed to other viewers. Publish a script only after a native run and secret/export review.

**Activepieces:** This source is an independent piece prototype. Upstream has paused unsolicited PRs and permits separately maintained packages; no PR should be opened just to bypass that policy. A native server import, supported-release check and package preparation are required before distribution.

**Node-RED:** Install the local package from `node-red/` in a separate development user directory, then import `historical-bars.json`. Use the node's password credential field or the runtime `SIFTINGIO_API_KEY` environment variable. Edit the Inject payload's dates and symbol. Click Inject manually; both output branches contain only newly created messages. The CSV branch produces text rather than writing files. The custom node uses built-in fetch because Node-RED's core HTTP Request node disables automatic decompression. No public gist or Flow Library entry is created by installing the package.

**Grafana:** Install the Infinity datasource. Configure its secure HTTP header name as `X-API-Key` and store your own key in the corresponding secure value. Restrict allowed hosts to `https://api.sifting.io`. Import the dashboard and select that datasource. It contains no key and no automatic refresh. Each manual refresh makes two requests, each limited to 300 rows. The dashboard is a first-page review table; it deliberately warns that the period can be incomplete. Verify epoch-millisecond parsing, headers, interpolation and rendering in the target Grafana/Infinity versions before publishing.

## References

- [SiftingIO API documentation](https://sifting.io/docs)
- [Public REST OpenAPI contract](https://sifting.io/openapi.yaml)
- [Forex product](https://sifting.io/product/forex)
- [Commodity product](https://sifting.io/product/commodities)
- [Plans and account allowances](https://sifting.io/pricing)

Maintained by SiftingIO. Public technical contact: info@sifting.io. Platform names identify the intended host and do not imply endorsement.
