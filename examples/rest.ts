/**
 * REST quick tour. Run with:  SIFTING_API_KEY=sft_… npx tsx examples/rest.ts
 */
import { SiftingClient, autoPaginate, SiftingApiError } from "../src/index.js";

const sifting = new SiftingClient({ apiKey: process.env.SIFTING_API_KEY });

async function main() {
  // 1. Live snapshots
  const trade = await sifting.last.trade("crypto", "BTCUSDT");
  console.log("BTC last trade:", trade.p, "@", new Date(trade.t).toISOString());

  // 2. Fundamentals
  const profile = await sifting.stocks.profile("AAPL");
  console.log(`${profile.name} (${profile.ticker}) — ${profile.sic_description}`);

  const ratios = await sifting.stocks.ratios("AAPL");
  console.log("Latest net margin:", ratios.latest?.net_margin);

  // 3. Historical bars (gzip negotiated automatically)
  const { data: bars } = await sifting.crypto.bars("ETHUSD", {
    start: "2024-01-01",
    end: "2024-01-02",
    interval: "1h",
  });
  console.log(`Got ${bars.length} ETH bars; first close = ${bars[0]?.c}`);

  // 4. Auto-paginated 10-K filings
  let count = 0;
  for await (const filing of autoPaginate((cursor) =>
    sifting.stocks.filings("AAPL", { cursor, form: "10-K" }),
  )) {
    count++;
    if (count <= 3) console.log("10-K:", filing.filed_at, filing.accession);
  }
  console.log(`Total 10-Ks: ${count}`);

  // 5. Markets + economic calendar
  const status = await sifting.markets.status("us_equities");
  console.log("US equities open?", status.data.is_open);

  const cal = await sifting.economicCalendar.list({ impact: "high", limit: 5 });
  console.log(`${cal.count} high-impact events upcoming`);
}

main().catch((err) => {
  if (err instanceof SiftingApiError) {
    console.error(`API error ${err.status} (${err.code}): ${err.message}`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
