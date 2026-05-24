/**
 * Live WebSocket tour. In Node, install `ws` first (npm i ws).
 * Run with:  SIFTING_API_KEY=sft_… npx tsx examples/websocket.ts
 */
import { SiftingClient } from "../src/index.js";

const sifting = new SiftingClient({ apiKey: process.env.SIFTING_API_KEY });

async function main() {
  const socket = sifting.ws({ heartbeatInterval: 15_000 });

  socket.on("open", () => console.log("connected"));
  socket.on("reconnect", ({ attempt }) => console.log("reconnecting, attempt", attempt));
  socket.on("error", (e) => console.error("server error:", e.code, e.message));

  socket.on("tick", (t) => {
    const px = t.p ?? `${t.b}/${t.a}`;
    console.log(`[${t.class ?? "tick"}] ${t.s} ${px}`);
  });
  socket.on("tvl", (v) => console.log(`[tvl] ${v.s} $${v.usd}`));

  await socket.connect();
  socket.subscribe("cex", ["BTCUSDT", "ETHUSDT"]);
  socket.subscribe("tvl", ["eth:WETH-USDC"]);

  // Stream for 30s, then close cleanly.
  setTimeout(() => {
    socket.close();
    console.log("done");
  }, 30_000);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
