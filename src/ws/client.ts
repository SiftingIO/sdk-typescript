import { SiftingError } from "../errors.js";
import type { HttpClient } from "../http.js";
import type {
  WsEventMap,
  WsProduct,
  WsServerFrame,
} from "./types.js";

/** Minimal structural type both the browser `WebSocket` and the `ws` package satisfy. */
export interface MinimalWebSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (ev: any) => void): void;
  removeEventListener(type: string, listener: (ev: any) => void): void;
}
export type WebSocketCtor = new (url: string) => MinimalWebSocket;

const OPEN = 1;

export interface SiftingSocketOptions {
  /** Reconnect automatically on unexpected close. Default: true. */
  autoReconnect?: boolean;
  /** Initial reconnect backoff in ms (doubles per attempt, capped at `maxReconnectDelay`). Default: 500. */
  reconnectDelay?: number;
  /** Max reconnect backoff in ms. Default: 30000. */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms; a `ping` is sent each interval. 0 disables. Default: 20000. */
  heartbeatInterval?: number;
  /** Inject a WebSocket implementation. Defaults to global `WebSocket`, else the `ws` package. */
  webSocket?: WebSocketCtor;
}

type Listener<T> = (payload: T) => void;

/**
 * Typed, auto-reconnecting WebSocket client for the SiftingIO live stream.
 *
 * Obtain one via `client.ws()`. Subscriptions are tracked and replayed on
 * reconnect, so callers subscribe once and keep receiving data across drops.
 *
 * ```ts
 * const socket = client.ws();
 * socket.on("tick", (t) => console.log(t.s, t.p));
 * await socket.connect();
 * socket.subscribe("cex", ["BTCUSDT", "ETHUSDT"]);
 * ```
 */
export class SiftingSocket {
  private ws?: MinimalWebSocket;
  private readonly listeners: { [K in keyof WsEventMap]?: Set<Listener<WsEventMap[K]>> } = {};
  /** Desired subscriptions, replayed on every (re)connect. */
  private readonly subscriptions = new Map<WsProduct, Set<string>>();
  private ctor?: WebSocketCtor;
  private reconnectAttempt = 0;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private closedByUser = false;

  private readonly autoReconnect: boolean;
  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly heartbeatInterval: number;

  constructor(
    private readonly http: HttpClient,
    private readonly opts: SiftingSocketOptions = {},
  ) {
    this.autoReconnect = opts.autoReconnect ?? true;
    this.reconnectDelay = opts.reconnectDelay ?? 500;
    this.maxReconnectDelay = opts.maxReconnectDelay ?? 30_000;
    this.heartbeatInterval = opts.heartbeatInterval ?? 20_000;
  }

  // ── Event subscription ───────────────────────────────────────────────────

  /** Register a listener. Returns an unsubscribe function. */
  on<K extends keyof WsEventMap>(event: K, listener: Listener<WsEventMap[K]>): () => void {
    let set = this.listeners[event] as Set<Listener<WsEventMap[K]>> | undefined;
    if (!set) {
      set = new Set();
      this.listeners[event] = set as never;
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Remove a previously registered listener. */
  off<K extends keyof WsEventMap>(event: K, listener: Listener<WsEventMap[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  /** Register a one-shot listener. */
  once<K extends keyof WsEventMap>(event: K, listener: Listener<WsEventMap[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  private emit<K extends keyof WsEventMap>(event: K, payload: WsEventMap[K]): void {
    this.listeners[event]?.forEach((l) => {
      try {
        l(payload);
      } catch {
        // A throwing listener must not break the read loop.
      }
    });
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /** Open the connection. Resolves once the socket is open and subscriptions are sent. */
  async connect(): Promise<void> {
    this.closedByUser = false;
    if (this.ws && this.ws.readyState === OPEN) return;

    this.ctor ??= await resolveWebSocket(this.opts.webSocket);
    const url = await this.http.wsConnectUrl();
    const ws = new this.ctor(url);
    this.ws = ws;

    return new Promise<void>((resolve) => {
      let settled = false;

      ws.addEventListener("open", () => {
        this.reconnectAttempt = 0;
        this.flushSubscriptions();
        this.startHeartbeat();
        this.emit("open", undefined);
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      ws.addEventListener("message", (ev: { data: unknown }) => {
        this.handleMessage(ev.data);
      });

      ws.addEventListener("error", (err: unknown) => {
        this.emit("socketError", err);
        // The browser fires `error` then `close`; reconnect is handled in close.
      });

      ws.addEventListener("close", (ev: { code?: number; reason?: string }) => {
        this.stopHeartbeat();
        this.ws = undefined;
        this.emit("close", { code: ev?.code ?? 1006, reason: ev?.reason ?? "" });
        if (!settled) {
          // Failed before ever opening — resolve so callers aren't hung; the
          // reconnect loop (if enabled) keeps trying in the background.
          settled = true;
          resolve();
        }
        this.scheduleReconnect();
      });
    });
  }

  /** Close the connection and stop reconnecting. */
  close(code = 1000, reason = "client closed"): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close(code, reason);
    this.ws = undefined;
  }

  /** Whether the socket is currently open. */
  get connected(): boolean {
    return this.ws?.readyState === OPEN;
  }

  // ── Operations ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to symbols on a product channel. Safe to call before `connect()`
   * or while disconnected — the request is tracked and (re)sent on open.
   */
  subscribe(product: WsProduct, symbols: string[]): void {
    const set = this.subscriptions.get(product) ?? new Set<string>();
    for (const s of symbols) set.add(s);
    this.subscriptions.set(product, set);
    if (this.connected) this.send({ op: "subscribe", product, symbols });
  }

  /** Unsubscribe from symbols on a product channel. */
  unsubscribe(product: WsProduct, symbols: string[]): void {
    const set = this.subscriptions.get(product);
    if (set) {
      for (const s of symbols) set.delete(s);
      if (set.size === 0) this.subscriptions.delete(product);
    }
    if (this.connected) this.send({ op: "unsubscribe", product, symbols });
  }

  /** Send an application-level ping. The server replies with a `pong` frame. */
  ping(): void {
    if (this.connected) this.send({ op: "ping" });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private send(op: import("./types.js").WsClientOp): void {
    this.ws?.send(JSON.stringify(op));
  }

  private flushSubscriptions(): void {
    for (const [product, set] of this.subscriptions) {
      if (set.size > 0) this.send({ op: "subscribe", product, symbols: [...set] });
    }
  }

  private handleMessage(data: unknown): void {
    let frame: WsServerFrame;
    try {
      frame = JSON.parse(typeof data === "string" ? data : String(data)) as WsServerFrame;
    } catch {
      return; // Ignore non-JSON frames.
    }
    this.emit("message", frame);
    switch (frame.f) {
      case "tick":
        this.emit("tick", frame);
        break;
      case "tvl":
        this.emit("tvl", frame);
        break;
      case "ack":
        this.emit("ack", frame);
        break;
      case "pong":
        this.emit("pong", frame);
        break;
      case "error":
        this.emit("error", frame);
        break;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval <= 0) return;
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.ping(), this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || !this.autoReconnect) return;
    const attempt = ++this.reconnectAttempt;
    const delay = Math.min(
      this.maxReconnectDelay,
      this.reconnectDelay * 2 ** (attempt - 1),
    );
    this.emit("reconnect", { attempt });
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch((err) => this.emit("socketError", err));
    }, delay);
  }
}

/** Resolve a WebSocket constructor: explicit override → global → `ws` package. */
async function resolveWebSocket(provided?: WebSocketCtor): Promise<WebSocketCtor> {
  if (provided) return provided;
  const g = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (typeof g !== "undefined") return g;
  try {
    const mod = (await import("ws")) as unknown as {
      default?: WebSocketCtor;
      WebSocket?: WebSocketCtor;
    };
    const ctor = mod.default ?? mod.WebSocket;
    if (ctor) return ctor;
    throw new Error("ws module had no constructor export");
  } catch {
    throw new SiftingError(
      "No WebSocket implementation available. In Node, install `ws` (npm i ws), " +
        "or pass `webSocket` in the ws() options.",
    );
  }
}
