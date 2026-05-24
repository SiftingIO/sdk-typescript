/** WebSocket protocol types for `wss://stream.sifting.io/ws/v1`. */

/** Subscribable product channels. */
export type WsProduct = "cex" | "dex" | "fx" | "us" | "tvl";

/** Operations the client sends to the server. */
export type WsClientOp =
  | { op: "auth"; key: string }
  | { op: "subscribe"; product: WsProduct; symbols: string[] }
  | { op: "unsubscribe"; product: WsProduct; symbols: string[] }
  | { op: "ping" };

/** Acknowledgement of a successful op. */
export interface WsAck {
  f: "ack";
  [key: string]: unknown;
}

/** Reply to a `ping`. */
export interface WsPong {
  f: "pong";
  [key: string]: unknown;
}

/**
 * A price update. Fields mirror the REST live shapes: `p`/`P` trade
 * price/size, `b`/`B`/`a`/`A` bid/ask price/size, `t` Unix epoch ms.
 */
export interface WsTick {
  f: "tick";
  /** Symbol. */
  s: string;
  /** Trade price. */
  p?: string;
  /** Trade size. */
  P?: string;
  /** Bid price. */
  b?: string;
  /** Bid size. */
  B?: string;
  /** Ask price. */
  a?: string;
  /** Ask size. */
  A?: string;
  /** Timestamp, Unix epoch milliseconds. */
  t: number;
  /** Asset class tag. */
  class?: string;
}

/** A TVL update for a DEX pool. */
export interface WsTVL {
  f: "tvl";
  s: string;
  usd: string;
  r0: string;
  r1: string;
  n: number;
  t: number;
}

/** A server-side error frame (op rejected, limit exceeded, …). */
export interface WsErrorFrame {
  f: "error";
  code: string;
  message: string;
  /** Present on limit-related errors. */
  limit?: number;
}

/** Any frame the server may send. */
export type WsServerFrame = WsAck | WsPong | WsTick | WsTVL | WsErrorFrame;

/** Event map for {@link import("./client.js").SiftingSocket} listeners. */
export interface WsEventMap {
  /** Transport connection opened (and (re)subscribed). */
  open: void;
  /** Transport connection closed. */
  close: { code: number; reason: string };
  /** A reconnect attempt is starting. */
  reconnect: { attempt: number };
  /** Transport-level error (not a server error frame). */
  socketError: unknown;
  /** Any decoded server frame (catch-all). */
  message: WsServerFrame;
  /** Price update. */
  tick: WsTick;
  /** TVL update. */
  tvl: WsTVL;
  /** Op acknowledgement. */
  ack: WsAck;
  /** Ping reply. */
  pong: WsPong;
  /** Server error frame. */
  error: WsErrorFrame;
}
