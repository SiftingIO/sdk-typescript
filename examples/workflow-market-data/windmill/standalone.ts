/** Small, read-only examples against the public SiftingIO REST contract. */
type AssetClass = 'forex' | 'commodities';
type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1mo';
type RequestWindow = {
  asset_class: AssetClass; symbol: string; start: string; end: string;
  interval?: Interval; limit?: number; cursor?: string;
};
type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };
type Page = {
  request: RequestWindow; rows: Bar[]; as_of: string | null;
  reported_symbol: string | null; next_cursor: string | null; has_more: boolean;
  row_count: number; interpretation: string;
};
const intervals = new Set(['1m','5m','15m','30m','1h','1d','1w','1mo']);
function utcDate(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value))
    throw new Error('Use YYYY-MM-DD or an ISO timestamp ending in Z.');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10) !== value.slice(0,10))
    throw new Error('Invalid UTC date.');
  return ms;
}
function validateRequest(input: RequestWindow): RequestWindow {
  if (!input || !['forex','commodities'].includes(input.asset_class)) throw new Error('Choose forex or commodities.');
  const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(symbol)) throw new Error('Use a catalog instrument code, such as EURUSD or XAUUSD.');
  if (utcDate(input.start) > utcDate(input.end)) throw new Error('Start must not be after end.');
  const interval = input.interval ?? '1h';
  if (!intervals.has(interval)) throw new Error('Unsupported bar interval.');
  const limit = input.limit ?? 300;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error('Limit must be an integer from 1 to 2000.');
  if (input.cursor !== undefined && (typeof input.cursor !== 'string' || input.cursor.length > 4096)) throw new Error('Invalid pagination cursor.');
  return { asset_class: input.asset_class, symbol, start: input.start, end: input.end, interval, limit, ...(input.cursor ? {cursor:input.cursor} : {}) };
}
function requestUrl(input: RequestWindow): string {
  const r = validateRequest(input);
  const url = new URL(`https://api.sifting.io/v1/hist/${r.asset_class}/${r.symbol}/bars`);
  for (const name of ['start','end','interval','limit','cursor'] as const) {
    if (r[name] !== undefined) url.searchParams.set(name, String(r[name]));
  }
  return url.toString();
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function normalizePage(value: unknown, input: RequestWindow): Page {
  const request = validateRequest(input);
  const response = record(value);
  if (!Array.isArray(response.data)) throw new Error('Expected a data array.');
  const rows = response.data.map((item): Bar => {
    const b = record(item);
    for (const field of ['t','o','h','l','c']) {
      if (typeof b[field] !== 'number' || !Number.isFinite(b[field])) throw new Error('Invalid bar: missing or non-finite numeric value.');
    }
    const bar = {t:b.t as number,o:b.o as number,h:b.h as number,l:b.l as number,c:b.c as number};
    if (!Number.isSafeInteger(bar.t) || !Number.isFinite(new Date(bar.t).getTime())) throw new Error('Invalid bar timestamp: expected Unix milliseconds.');
    if (bar.l > bar.h || bar.o < bar.l || bar.o > bar.h || bar.c < bar.l || bar.c > bar.h) throw new Error('Invalid OHLC range.');
    if (b.v !== undefined && (typeof b.v !== 'number' || !Number.isFinite(b.v))) throw new Error('Invalid reported volume/tick count.');
    return {...bar, ...(typeof b.v === 'number' ? {v:b.v} : {})};
  });
  const meta = response.meta === undefined ? {} : record(response.meta);
  if (meta.next_cursor !== undefined && meta.next_cursor !== null && typeof meta.next_cursor !== 'string') throw new Error('Invalid pagination metadata.');
  const next_cursor = typeof meta.next_cursor === 'string' && meta.next_cursor ? meta.next_cursor : null;
  return { request, rows, as_of:typeof meta.as_of === 'string' ? meta.as_of : null,
    reported_symbol:typeof meta.symbol === 'string' ? meta.symbol : null,
    next_cursor, has_more:next_cursor !== null, row_count:rows.length,
    interpretation:'Historical bars, not live quotes. One page only; inspect next_cursor. Forex v is a reported tick count, not exchange-traded volume; an absent v remains absent.' };
}
async function readHistorical(api_key: string, input: RequestWindow, fetcher: typeof fetch = fetch): Promise<Page> {
  if (typeof api_key !== 'string' || !api_key.trim()) throw new Error('Configure your own SiftingIO API key as a secret.');
  const request = validateRequest(input);
  let response: Response;
  try {
    response = await fetcher(requestUrl(request), {method:'GET', headers:{'X-API-Key':api_key,'Accept':'application/json','Accept-Encoding':'gzip'}, redirect:'error', signal:AbortSignal.timeout(15000)});
  } catch {
    throw new Error('Market-data request failed or timed out. No automatic retry was made.');
  }
  if (!response.ok) {
    const guidance: Record<number,string> = {401:'Check the API key.',403:'Check account permissions.',406:'The endpoint requires gzip.',422:'The requested period is unavailable; inspect coverage in the account.',429:'Request allowance or rate limit reached; inspect Retry-After before retrying.'};
    throw new Error(`SiftingIO returned HTTP ${response.status}. ${guidance[response.status] ?? 'Consult the API documentation.'}`);
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('Expected a JSON market-data response.'); }
  return normalizePage(data, request);
}
function toCsv(page: Page): string {
  const header = 'asset_class,symbol,interval,time_utc,open,high,low,close,reported_v';
  return [header, ...page.rows.map(b => [page.request.asset_class,page.request.symbol,page.request.interval,new Date(b.t).toISOString(),b.o,b.h,b.l,b.c,b.v ?? ''].join(','))].join('\n')+'\n';
}

// Windmill Hub script. Bind api_key to a Windmill secret variable, not a literal.
export async function main(api_key: string, asset_class: AssetClass, symbol: string, start: string, end: string, interval: Interval = '1h', limit: number = 300, cursor?: string) {
  const page = await readHistorical(api_key, {asset_class,symbol,start,end,interval,limit,cursor});
  return {...page,csv:toCsv(page)};
}
