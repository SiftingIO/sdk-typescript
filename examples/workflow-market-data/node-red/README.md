# node-red-contrib-siftingio (unpublished prototype)

Read one bounded page of SiftingIO Forex or commodity historical bars. Requires Node.js 20+. The code is not yet published to npm or the Flow Library, and a native Node-RED runtime test remains outstanding.

Install this local directory only in a development Node-RED user directory, then import `historical-bars.json` from the parent examples package. Store your own API key in the node's password credential field, or set the runtime `SIFTINGIO_API_KEY` environment variable. No key is included in the package.

Input is an object in `msg.payload` with `asset_class`, `symbol`, `start`, `end`, optional `interval`, `limit` and `cursor`. Forex EURUSD and commodity XAUUSD are distinct asset/symbol combinations. Dates are inclusive and UTC; the default limit is 300 and maximum 2,000.

Output 1 contains a validated page with `row_count`, `has_more` and `next_cursor`. Output 2 is CSV text. No files are written. The node creates new output messages and discards incoming transport headers. It does not retry, schedule or fetch further pages. HTTPS redirects fail instead of forwarding your API key.

These are historical bars, not live quotes. Unix timestamps are milliseconds. Forex v is a reported tick count, not exchange-traded volume. Missing v is not replaced by an invented zero. Account allowances and the separate market-data licence apply.

[API documentation](https://sifting.io/docs) · [Forex](https://sifting.io/product/forex) · [Commodities](https://sifting.io/product/commodities)

Maintainer: SiftingIO, info@sifting.io. Source code is MIT; market-data rights are separate.
