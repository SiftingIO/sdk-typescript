const intervals = new Set(['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1mo']);
function utcDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value))
        throw new Error('Use YYYY-MM-DD or an ISO timestamp ending in Z.');
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value.slice(0, 10))
        throw new Error('Invalid UTC date.');
    return ms;
}
export function validateRequest(input) {
    if (!input || !['forex', 'commodities'].includes(input.asset_class))
        throw new Error('Choose forex or commodities.');
    const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{4,12}$/.test(symbol))
        throw new Error('Use a catalog instrument code, such as EURUSD or XAUUSD.');
    if (utcDate(input.start) > utcDate(input.end))
        throw new Error('Start must not be after end.');
    const interval = input.interval ?? '1h';
    if (!intervals.has(interval))
        throw new Error('Unsupported bar interval.');
    const limit = input.limit ?? 300;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
        throw new Error('Limit must be an integer from 1 to 2000.');
    if (input.cursor !== undefined && (typeof input.cursor !== 'string' || input.cursor.length > 4096))
        throw new Error('Invalid pagination cursor.');
    return { asset_class: input.asset_class, symbol, start: input.start, end: input.end, interval, limit, ...(input.cursor ? { cursor: input.cursor } : {}) };
}
export function requestUrl(input) {
    const r = validateRequest(input);
    const url = new URL(`https://api.sifting.io/v1/hist/${r.asset_class}/${r.symbol}/bars`);
    for (const name of ['start', 'end', 'interval', 'limit', 'cursor']) {
        if (r[name] !== undefined)
            url.searchParams.set(name, String(r[name]));
    }
    return url.toString();
}
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected a JSON object.');
    return value;
}
export function normalizePage(value, input) {
    const request = validateRequest(input);
    const response = record(value);
    if (!Array.isArray(response.data))
        throw new Error('Expected a data array.');
    const rows = response.data.map((item) => {
        const b = record(item);
        for (const field of ['t', 'o', 'h', 'l', 'c']) {
            if (typeof b[field] !== 'number' || !Number.isFinite(b[field]))
                throw new Error('Invalid bar: missing or non-finite numeric value.');
        }
        const bar = { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c };
        if (!Number.isSafeInteger(bar.t) || !Number.isFinite(new Date(bar.t).getTime()))
            throw new Error('Invalid bar timestamp: expected Unix milliseconds.');
        if (bar.l > bar.h || bar.o < bar.l || bar.o > bar.h || bar.c < bar.l || bar.c > bar.h)
            throw new Error('Invalid OHLC range.');
        if (b.v !== undefined && (typeof b.v !== 'number' || !Number.isFinite(b.v)))
            throw new Error('Invalid reported volume/tick count.');
        return { ...bar, ...(typeof b.v === 'number' ? { v: b.v } : {}) };
    });
    const meta = response.meta === undefined ? {} : record(response.meta);
    if (meta.next_cursor !== undefined && meta.next_cursor !== null && typeof meta.next_cursor !== 'string')
        throw new Error('Invalid pagination metadata.');
    const next_cursor = typeof meta.next_cursor === 'string' && meta.next_cursor ? meta.next_cursor : null;
    return { request, rows, as_of: typeof meta.as_of === 'string' ? meta.as_of : null,
        reported_symbol: typeof meta.symbol === 'string' ? meta.symbol : null,
        next_cursor, has_more: next_cursor !== null, row_count: rows.length,
        interpretation: 'Historical bars, not live quotes. One page only; inspect next_cursor. Forex v is a reported tick count, not exchange-traded volume; an absent v remains absent.' };
}
export async function readHistorical(api_key, input, fetcher = fetch) {
    if (typeof api_key !== 'string' || !api_key.trim())
        throw new Error('Configure your own SiftingIO API key as a secret.');
    const request = validateRequest(input);
    let response;
    try {
        response = await fetcher(requestUrl(request), { method: 'GET', headers: { 'X-API-Key': api_key, 'Accept': 'application/json', 'Accept-Encoding': 'gzip' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    }
    catch {
        throw new Error('Market-data request failed or timed out. No automatic retry was made.');
    }
    if (!response.ok) {
        const guidance = { 401: 'Check the API key.', 403: 'Check account permissions.', 406: 'The endpoint requires gzip.', 422: 'The requested period is unavailable; inspect coverage in the account.', 429: 'Request allowance or rate limit reached; inspect Retry-After before retrying.' };
        throw new Error(`SiftingIO returned HTTP ${response.status}. ${guidance[response.status] ?? 'Consult the API documentation.'}`);
    }
    let data;
    try {
        data = await response.json();
    }
    catch {
        throw new Error('Expected a JSON market-data response.');
    }
    return normalizePage(data, request);
}
export function toCsv(page) {
    const header = 'asset_class,symbol,interval,time_utc,open,high,low,close,reported_v';
    return [header, ...page.rows.map(b => [page.request.asset_class, page.request.symbol, page.request.interval, new Date(b.t).toISOString(), b.o, b.h, b.l, b.c, b.v ?? ''].join(','))].join('\n') + '\n';
}
