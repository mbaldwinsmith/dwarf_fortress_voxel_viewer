import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connect } from "../src/viewer/connection.js";
import { isHeartbeat } from "../src/shared/heartbeat.js";

class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: Record<string, unknown>[] = [];
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(value: string) {
    if (this.readyState !== 1) throw Error("Not open");
    this.sent.push(JSON.parse(value));
  }
  close = vi.fn(() => {
    this.readyState = 3;
  });
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}
let win: EventTarget, doc: EventTarget & { visibilityState: string };
let disconnect: ReturnType<typeof connect> | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  win = new EventTarget();
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("location", { protocol: "http:", host: "127.0.0.1:5173" });
});
afterEach(() => {
  disconnect?.();
  disconnect = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const latest = () => Socket.instances.at(-1)!;
const reset = {
  type: "reset",
  session: "fortress",
  world: "Fortress",
  bounds: { x: 0, y: 0, z: 0, width: 32, depth: 32, height: 20 },
  level: 4,
  mode: "map",
};

it("reconnects once after a drop and ignores callbacks from retired sockets", () => {
  const receive = vi.fn();
  disconnect = connect(receive, vi.fn());
  const old = latest();
  old.open();
  const staleClose = old.onclose!,
    staleMessage = old.onmessage!;
  old.drop();
  vi.advanceTimersByTime(2000);
  const current = latest();
  current.open();
  staleClose();
  staleMessage({ data: JSON.stringify({ type: "status", message: "old" }) });
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(2);
  expect(receive).not.toHaveBeenCalled();
  current.message(reset);
  expect(receive).toHaveBeenCalledWith(reset);
});
it("recovers from a hanging handshake and errors without waiting for a close event", () => {
  disconnect = connect(vi.fn(), vi.fn());
  const hanging = latest();
  vi.advanceTimersByTime(8000);
  expect(hanging.close).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(2);
  latest().onerror?.();
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(3);
});
it("detects a silently dead open connection and keeps a quiet healthy companion alive", () => {
  disconnect = connect(vi.fn(), vi.fn());
  latest().open();
  vi.advanceTimersByTime(15000);
  expect(latest().close).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(2000);
  const healthy = latest();
  healthy.open();
  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(5000);
    const ping = healthy.sent.at(-1)!;
    expect(ping.type).toBe("ping");
    healthy.message({ type: "pong", nonce: ping.nonce });
  }
  expect(Socket.instances).toHaveLength(2);
  expect(healthy.close).not.toHaveBeenCalled();
});
it("restores bounded view preferences after reset but never replays mining requests", () => {
  disconnect = connect(vi.fn(), vi.fn());
  const first = latest();
  first.open();
  disconnect.setMode("screen");
  disconnect.setLevel(8, 12, 13);
  expect(
    disconnect.mine({
      type: "mining",
      id: 1,
      session: "fortress",
      mode: "dig",
      operation: "mine",
      x: 12,
      y: 13,
      z: 8,
    }),
  ).toBe(true);
  first.drop();
  disconnect.setLevel(9, 12, 13);
  vi.advanceTimersByTime(2000);
  const next = latest();
  next.open();
  expect(next.sent).toEqual([]);
  next.message(reset);
  expect(next.sent).toEqual([
    { type: "mode", mode: "screen" },
    { type: "level", z: 9, x: 12, y: 13 },
  ]);
  next.message(reset);
  expect(next.sent).toHaveLength(2);
  next.drop();
  vi.advanceTimersByTime(2000);
  latest().open();
  latest().message({ ...reset, bounds: { ...reset.bounds, height: 5 } });
  expect(latest().sent).toEqual([{ type: "mode", mode: "screen" }]);
});
it("resumes cached pages and wakes retries on network recovery without reviving disposed clients", () => {
  disconnect = connect(vi.fn(), vi.fn());
  latest().open();
  disconnect.suspend();
  vi.advanceTimersByTime(30000);
  expect(Socket.instances).toHaveLength(1);
  disconnect.resume();
  latest().open();
  latest().drop();
  win.dispatchEvent(new Event("online"));
  expect(Socket.instances).toHaveLength(3);
  latest().open();
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(3);
  disconnect();
  disconnect.resume();
  win.dispatchEvent(new Event("online"));
  vi.advanceTimersByTime(30000);
  expect(Socket.instances).toHaveLength(3);
});
it("resynchronises invalid messages without reloading the page or retaining stale timers", () => {
  const status = vi.fn();
  disconnect = connect(vi.fn(), status);
  latest().open();
  latest().message({ type: "chunks", broken: true });
  expect(status.mock.calls.at(-1)?.[0]).toMatch(/Invalid bridge response/);
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(2);
  latest().open();
  disconnect.reconnect();
  disconnect.reconnect();
  vi.advanceTimersByTime(2000);
  expect(Socket.instances).toHaveLength(3);
});
it("validates heartbeat envelopes independently of fortress/game state", () => {
  expect(isHeartbeat({ type: "ping", nonce: 1 }, "ping")).toBe(true);
  for (const value of [
    null,
    { type: "pong", nonce: 1 },
    { type: "ping", nonce: -1 },
    { type: "ping", nonce: 1.5 },
    { type: "ping", nonce: "1" },
  ])
    expect(isHeartbeat(value, "ping")).toBe(false);
});
