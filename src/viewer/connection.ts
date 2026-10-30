import type { ServerMessage } from "../shared/model.js";
import { parseServerMessage } from "../shared/validation.js";
import type { MiningRequest } from "../shared/mining.js";
import { isHeartbeat } from "../shared/heartbeat.js";
const RETRY_MS = 2000;
const CONNECT_TIMEOUT_MS = 8000;
const HEARTBEAT_MS = 5000;
const SILENCE_TIMEOUT_MS = 15000;
export function connect(
  receive: (m: ServerMessage) => void,
  status: (s: string) => void,
) {
  let socket: WebSocket | undefined,
    retryTimer: ReturnType<typeof setTimeout> | undefined,
    watchdog: ReturnType<typeof setTimeout> | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined,
    closed = false,
    suspended = false,
    lastSeen = 0,
    nonce = 0;
  let desiredMode: "screen" | "map" | undefined;
  let desiredLevel:
    { type: "level"; z: number; x?: number; y?: number } | undefined;
  function retire() {
    clearTimeout(watchdog);
    clearInterval(heartbeat);
    const previous = socket;
    socket = undefined;
    if (previous) {
      previous.onopen =
        previous.onmessage =
        previous.onerror =
        previous.onclose =
          null;
      previous.close();
    }
  }
  function retry(message = "Companion disconnected · reconnecting…") {
    if (closed || suspended) return;
    retire();
    status(message);
    if (retryTimer === undefined)
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        open();
      }, RETRY_MS);
  }
  function send(value: unknown) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(value));
      return true;
    } catch {
      retry();
      return false;
    }
  }
  function open() {
    if (closed || suspended || socket) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`,
      );
    } catch {
      retry("Cannot reach local companion service · reconnecting…");
      return;
    }
    socket = ws;
    lastSeen = Date.now();
    let restoreView = true;
    const current = () => !closed && !suspended && socket === ws;
    watchdog = setTimeout(() => {
      if (current()) retry("Companion connection timed out · reconnecting…");
    }, CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      if (!current()) return;
      clearTimeout(watchdog);
      lastSeen = Date.now();
      heartbeat = setInterval(() => {
        if (!current()) return;
        if (Date.now() - lastSeen >= SILENCE_TIMEOUT_MS) {
          retry("Companion stopped responding · reconnecting…");
          return;
        }
        send({ type: "ping", nonce: ++nonce });
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (e) => {
      if (!current()) return;
      try {
        const value: unknown = JSON.parse(String(e.data));
        if (isHeartbeat(value, "pong")) {
          lastSeen = Date.now();
          return;
        }
        const message = parseServerMessage(value);
        lastSeen = Date.now();
        receive(message);
        if (restoreView && message.type === "reset" && message.bounds.height) {
          restoreView = false;
          // Wait for current bounds before restoring preferences. A different
          // fortress may have fewer z-levels. Never repeat a mining action.
          if (desiredMode && desiredMode !== message.mode)
            send({ type: "mode", mode: desiredMode });
          const b = message.bounds;
          if (desiredLevel) {
            if (desiredLevel.z >= b.z && desiredLevel.z < b.z + b.height) {
              const { x, y } = desiredLevel;
              const focus =
                x !== undefined &&
                y !== undefined &&
                x >= b.x &&
                y >= b.y &&
                x < b.x + b.width &&
                y < b.y + b.depth;
              send(focus ? desiredLevel : { type: "level", z: desiredLevel.z });
            } else desiredLevel = undefined;
          }
        }
      } catch (err) {
        if (current())
          retry(`Invalid bridge response: ${String(err)} · reconnecting…`);
      }
    };
    ws.onerror = () => {
      if (current())
        retry("Cannot reach local companion service · reconnecting…");
    };
    ws.onclose = () => {
      if (current()) retry();
    };
  }
  const recover = () => {
    if (closed || suspended || document.visibilityState === "hidden") return;
    if (
      socket?.readyState === WebSocket.OPEN &&
      Date.now() - lastSeen < SILENCE_TIMEOUT_MS
    )
      return;
    if (
      socket?.readyState === WebSocket.CONNECTING &&
      Date.now() - lastSeen < CONNECT_TIMEOUT_MS
    )
      return;
    retire();
    clearTimeout(retryTimer);
    retryTimer = undefined;
    open();
  };
  window.addEventListener("online", recover);
  document.addEventListener("visibilitychange", recover);
  open();
  return Object.assign(
    () => {
      closed = true;
      clearTimeout(retryTimer);
      retire();
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
    },
    {
      reconnect: () => retry("State resynchronising · reconnecting…"),
      suspend: () => {
        suspended = true;
        clearTimeout(retryTimer);
        retryTimer = undefined;
        retire();
      },
      resume: () => {
        if (!closed) {
          suspended = false;
          recover();
        }
      },
      mine: (request: MiningRequest) => send(request),
      setMode: (mode: "screen" | "map") => {
        desiredMode = mode;
        send({ type: "mode", mode });
      },
      setLevel: (z: number, x?: number, y?: number) => {
        desiredLevel = { type: "level", z, x, y };
        send(desiredLevel);
      },
    },
  );
}
