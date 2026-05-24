import type { ListResponse } from "./types.js";

/**
 * Auto-paginate any cursor-based list endpoint, yielding items one at a time
 * and fetching the next page transparently when the current one is exhausted.
 *
 * Pass a function that fetches one page given a cursor (`undefined` for the
 * first page). The SDK's list methods are shaped to plug straight in:
 *
 * ```ts
 * for await (const filing of autoPaginate((cursor) =>
 *   client.stocks.filings("AAPL", { cursor, form: "10-K" }),
 * )) {
 *   console.log(filing.accession);
 * }
 * ```
 *
 * @param fetchPage  Fetches one page for the given cursor.
 * @param maxItems   Optional hard cap on total items yielded.
 */
export async function* autoPaginate<T>(
  fetchPage: (cursor?: string) => Promise<ListResponse<T>>,
  maxItems?: number,
): AsyncGenerator<T, void, void> {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const page = await fetchPage(cursor);
    for (const item of page.data) {
      yield item;
      if (maxItems != null && ++count >= maxItems) return;
    }
    if (!page.meta.next_cursor) return;
    cursor = page.meta.next_cursor;
  }
}

/**
 * Collect every page of a cursor-based endpoint into a single array.
 * Convenience wrapper over {@link autoPaginate} — mind the memory cost on
 * large result sets; prefer the generator for streaming.
 */
export async function collectAll<T>(
  fetchPage: (cursor?: string) => Promise<ListResponse<T>>,
  maxItems?: number,
): Promise<T[]> {
  const out: T[] = [];
  for await (const item of autoPaginate(fetchPage, maxItems)) out.push(item);
  return out;
}
