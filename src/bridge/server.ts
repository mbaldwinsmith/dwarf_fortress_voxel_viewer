import "dotenv/config";
import { Graphics } from "./graphics.js";
import { SceneryGraphics } from "./scenery-graphics.js";
import { SceneryReader } from "./scenery.js";
import { CreatureReader } from "./creatures.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { FortressAdapter } from "./adapter.js";
import { ChunkCache } from "./chunk-cache.js";
import { type ServerMessage } from "../shared/model.js";
import { inspectInstallation } from "./installation.js";
import {
  blockOrder,
  columnBatches,
  parseLevel,
  parseMode,
  screenRegion,
  ScreenElevation,
} from "./region.js";
import { publicFile } from "./public-files.js";
const installation = process.env.DF_PATH
  ? await inspectInstallation(process.env.DF_PATH)
  : undefined;
if (installation)
  console.log(
    `Read-only installation inspection: ${installation.modules.length} available modules; active world order unresolved (explicit vanilla fallback profile)`,
  );
const port = Number(process.env.VIEWER_PORT ?? 4174),
  dfPort = Number(process.env.DFHACK_PORT ?? installation?.remotePort ?? 5000),
  pollMs = Math.max(100, Number(process.env.POLL_MS ?? 200));
for (const [name, n] of Object.entries({ port, dfPort, pollMs }))
  if (
    !Number.isSafeInteger(n) ||
    n < (name === "port" && process.env.VIEWER_DESKTOP === "1" ? 0 : 1) ||
    n > 65535
  )
    throw Error("Invalid port or polling configuration");
const graphics = new Graphics();
const sceneryGraphics = new SceneryGraphics(graphics.files);
if (installation) {
  try {
    await graphics.load(installation.root);
    await sceneryGraphics.load(installation.root);
  } catch (e) {
    console.warn(
      "Local graphics unavailable; using markers:",
      e instanceof Error ? e.message : String(e),
    );
  }
  console.log(`Vanilla simple sprite profile: ${graphics.refs.size} mappings`);
}
const root = path.resolve(process.env.VIEWER_DIST ?? "dist/viewer");
const server = http.createServer(async (req, res) => {
  try {
    if (process.env.VIEWER_DESKTOP === "1") {
      const address = server.address();
      const actualPort =
        address && typeof address === "object" ? address.port : port;
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:${actualPort}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      );
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status,
          clients: wss.clients.size,
          session,
          chunks: chunks.size,
          sceneryObjects: [...chunks.values()].reduce(
            (n, c) => n + (c.objects?.length ?? 0),
            0,
          ),
          creatures: lastCreatures?.creatures.length ?? 0,
          spriteCreatures:
            lastCreatures?.creatures.filter((u) => u.sprite || u.layers?.length)
              .length ?? 0,
        }),
      );
      return;
    }
    if (url.pathname.startsWith("/local-art/")) {
      const id = url.pathname.slice("/local-art/".length);
      const file = /^[a-f0-9]{24}$/.test(id)
        ? graphics.files.get(id)
        : undefined;
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(await readFile(file));
      return;
    }
    // Built UI only. No filesystem paths or DF assets accepted from clients.
    const file = publicFile(root, url.pathname);
    if (!file) {
      res.writeHead(403).end();
      return;
    }
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    const content = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] ?? "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(content);
  } catch {
    res
      .writeHead(404)
      .end("Build the viewer with npm run build, or use npm run dev.");
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 });
const origins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/live" || !origins.has(req.headers.origin ?? "")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});
let status = "Waiting for DFHack",
  session = "",
  sequence = 0,
  reset: Extract<ServerMessage, { type: "reset" }> | undefined;
const cache = new ChunkCache();
const chunks = cache.active;
const counters = new WeakMap<WebSocket, number>();
function send(ws: WebSocket, m: ServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 2 * 1024 * 1024) {
    ws.close(1013, "Slow client; reconnect to resynchronise");
    return;
  }
  if (m.type === "reset") counters.set(ws, 0);
  if (m.type === "chunks") {
    const sequence = (counters.get(ws) ?? 0) + 1;
    counters.set(ws, sequence);
    m = { ...m, sequence };
  }
  ws.send(JSON.stringify(m));
}
function broadcast(m: ServerMessage) {
  for (const ws of wss.clients) send(ws, m);
}
function setStatus(message: string) {
  if (status !== message) {
    status = message;
    console.log(message);
    broadcast({ type: "status", message });
  }
}
wss.on("connection", (ws) => {
  send(ws, { type: "status", message: status });
  if (reset) {
    send(ws, reset);
    void replay(ws, session);
    if (lastCreatures) send(ws, lastCreatures);
  }
  ws.on("message", (data) => {
    const mode = parseMode(data.toString());
    if (mode) {
      if (mode !== requestedMode) screenElevation.reset();
      requestedMode = mode;
      wakeStream?.();
      return;
    }
    const level = parseLevel(data.toString(), reset?.bounds);
    if (level === undefined) {
      ws.close(1008, "Invalid viewer operation");
      return;
    }
    requestedLevel = level;
    if (requestedMode === "screen") screenElevation.select(level);
    const m = JSON.parse(data.toString());
    requestedFocus =
      Number.isInteger(m.x) &&
      Number.isInteger(m.y) &&
      reset &&
      m.x >= reset.bounds.x &&
      m.y >= reset.bounds.y &&
      m.x < reset.bounds.x + reset.bounds.width &&
      m.y < reset.bounds.y + reset.bounds.depth
        ? { x: m.x, y: m.y }
        : undefined;
    wakeStream?.();
  });
  ws.on("error", (e) => console.warn(e.message));
});
let lastCreatures: Extract<ServerMessage, { type: "creatures" }> | undefined;
function publish(m: ServerMessage) {
  if (m.type === "reset") lastCreatures = undefined;
  if (m.type === "creatures") lastCreatures = m;
  broadcast(m);
}
let requestedMode: "screen" | "map" = "map";
let requestedLevel = 0;
let requestedFocus: { x: number; y: number } | undefined;
const screenElevation = new ScreenElevation();
async function replay(ws: WebSocket, replaySession: string) {
  for (const k of [...chunks.keys()]) {
    while (
      ws.bufferedAmount > 256 * 1024 &&
      ws.readyState === WebSocket.OPEN &&
      replaySession === session
    )
      await pause(20);
    if (ws.readyState !== WebSocket.OPEN || replaySession !== session) return;
    const c = chunks.get(k);
    if (c)
      send(ws, { type: "chunks", session, sequence: 0, chunks: [c], pollMs });
    await pause(0);
  }
}
let stopping = false,
  adapter: FortressAdapter | undefined;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
let wakeStream: (() => void) | undefined;
const streamPause = (ms: number) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      wakeStream = undefined;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    wakeStream = finish;
  });
async function run() {
  while (!stopping) {
    if (wss.clients.size === 0) {
      await pause(500);
      continue;
    }
    try {
      adapter = new FortressAdapter(dfPort);
      setStatus("Connecting to DFHack…");
      const version = await adapter.initialize();
      adapter.scenery = new SceneryReader(
        adapter.rpc,
        sceneryGraphics,
        adapter.bounds,
      );
      await adapter.scenery.initialize();
      console.log("Read-only handshake verified", version);
      session = randomUUID();
      sequence = 0;
      cache.clear();
      reset = {
        type: "reset",
        session,
        bounds: adapter.bounds,
        level: adapter.initialLevel,
        mode: "map",
        world: adapter.world,
      };
      publish(reset);
      setStatus("Loading actual fortress terrain…");

      requestedLevel = adapter.initialLevel;
      screenElevation.reset();
      const readScreenRegion = async () => {
        const region = screenRegion(
          adapter!.bounds,
          await adapter!.rpc.call("GetViewInfo"),
        );
        return { ...region, level: screenElevation.follow(region.level) };
      };
      const creatures = new CreatureReader(adapter, graphics);
      let creatureTick = 0,
        lastCreaturePoll = 0,
        lastItemPoll = 0;
      let sweep = 0;
      while (!stopping) {
        // Keep a warm read-only connection/cache through preview reloads.
        // Do not poll the game while no viewer is connected.
        if (!wss.clients.size) {
          await pause(500);
          continue;
        }
        const mode = requestedMode;
        const region =
          mode === "screen"
            ? await readScreenRegion()
            : { bounds: adapter.bounds, level: requestedLevel };
        const b = region.bounds,
          level = region.level;
        requestedLevel = level;
        if (
          reset.level !== level ||
          reset.mode !== mode ||
          JSON.stringify(reset.bounds) !== JSON.stringify(b) ||
          JSON.stringify(reset.focus) !== JSON.stringify(requestedFocus)
        ) {
          cache.select(b, level);
          reset = { ...reset, level, bounds: b, mode, focus: requestedFocus };
          publish({
            type: "view",
            session,
            level,
            bounds: b,
            mode,
            focus: requestedFocus,
          });
        }
        const started = performance.now();
        await adapter.checkWorld();
        let changed = 0,
          completed = 0;
        const focus = requestedFocus;
        const order = blockOrder(b, level, focus);
        const batches = columnBatches(order);
        // After the near-camera core, missing columns precede background refresh.
        const coreEnd = batches.findIndex((batch) =>
          batch.levels.some((z) => Math.abs(z - level) > 2),
        );
        const split = coreEnd < 0 ? batches.length : coreEnd;
        const scheduled = [
          ...batches.slice(0, split),
          ...batches
            .slice(split)
            .sort(
              (a, b) =>
                Number(
                  a.levels.every((z) => chunks.has(`${a.x},${a.y},${z}`)),
                ) -
                Number(b.levels.every((z) => chunks.has(`${b.x},${b.y},${z}`))),
            ),
        ];
        let reads = 0;
        for (const { x, y, levels } of scheduled) {
          if (
            stopping ||
            !wss.clients.size ||
            requestedLevel !== level ||
            requestedMode !== mode ||
            requestedFocus !== focus
          )
            break;
          if (mode === "screen" && completed % 12 === 0) {
            const current = await readScreenRegion();
            if (
              current.level !== level ||
              JSON.stringify(current.bounds) !== JSON.stringify(b)
            )
              break;
          }
          const t = performance.now();
          const restored = levels.flatMap((z) => {
            const k = `${x},${y},${z}`;
            if (chunks.has(k)) return [];
            const chunk = cache.restore(k);
            return chunk ? [chunk] : [];
          });
          if (restored.length)
            publish({
              type: "chunks",
              session,
              sequence: ++sequence,
              chunks: restored,
              pollMs: 0,
            });
          const needed = levels.filter(
            (z) =>
              !cache.fresh(
                `${x},${y},${z}`,
                t,
                Math.abs(z - level) <= 2 ? 2000 : 10000,
              ),
          );
          if (needed.length) {
            // Preserve the single-flight connection and check identity on both
            // sides of each bounded native column before publishing any terrain.
            await adapter.checkWorld();
            const column = await adapter.column(x, y, needed);
            await adapter.checkWorld();
            if (
              requestedLevel !== level ||
              requestedMode !== mode ||
              requestedFocus !== focus
            )
              break;
            const updates = column.filter((chunk) =>
              cache.store(chunk, performance.now()),
            );
            if (updates.length) {
              publish({
                type: "chunks",
                session,
                sequence: ++sequence,
                chunks: updates,
                pollMs: Math.round(performance.now() - t),
              });
              changed += updates.length;
            }
            reads++;
          }
          if (performance.now() - lastCreaturePoll >= 250) {
            const tickStarted = performance.now();
            const snapshot = await creatures.snapshot(b, level, chunks);
            await adapter.checkWorld();
            if (requestedMode === mode && requestedLevel === level)
              publish({
                type: "creatures",
                session,
                tick: ++creatureTick,
                creatures: snapshot,
              });
            lastCreaturePoll = tickStarted;
          }
          if (performance.now() - lastItemPoll >= 1000) {
            const tickStarted = performance.now();
            const [cx, cy] = order[0];
            const nearby = [...chunks.values()].filter(
              (c) =>
                Math.abs(c.x - cx) <= 16 &&
                Math.abs(c.y - cy) <= 16 &&
                Math.abs(c.z - level) <= 1,
            );
            await adapter.checkWorld();
            const items = await adapter.items(nearby);
            await adapter.checkWorld();
            if (
              requestedMode === mode &&
              requestedLevel === level &&
              requestedFocus === focus
            ) {
              const updates = items.filter((c) => cache.updateItems(c));
              if (updates.length)
                publish({
                  type: "chunks",
                  session,
                  sequence: ++sequence,
                  chunks: updates,
                  pollMs: 0,
                });
            }
            lastItemPoll = tickStarted;
          }
          completed += levels.length;
          if (completed % 12 === 0)
            setStatus(
              `Streaming Z ${level} · ${completed}/${order.length} blocks · sweep ${sweep + 1}`,
            );
          // Yield during initial loading; throttle batches rather than tiles.
          await streamPause(needed.length && reads % 4 === 0 ? pollMs : 0);
        }
        if (
          requestedLevel !== level ||
          requestedMode !== mode ||
          requestedFocus !== focus
        )
          continue;
        setStatus(
          `Live · ${adapter.world} · ${chunks.size} blocks · sweep ${++sweep}`,
        );
        console.log(
          JSON.stringify({
            sweep,
            changed,
            sweepMs: Math.round(performance.now() - started),
            heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
          }),
        );
        await streamPause(pollMs);
      }
    } catch (e) {
      reset = undefined;
      cache.clear();
      session = randomUUID();
      publish({
        type: "reset",
        session,
        bounds: { x: 0, y: 0, z: 0, width: 0, depth: 0, height: 0 },
        world: "",
      });
      setStatus(
        `Disconnected · ${e instanceof Error ? e.message : String(e)}. Load a fortress; retrying in 3 seconds.`,
      );
      await pause(3000);
    } finally {
      adapter?.close();
      adapter = undefined;
    }
  }
}
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : port;
  origins.add(`http://127.0.0.1:${actualPort}`);
  origins.add(`http://localhost:${actualPort}`);
  if (process.env.VIEWER_DESKTOP === "1") {
    const parent = (
      process as NodeJS.Process & {
        parentPort?: { postMessage: (message: unknown) => void };
      }
    ).parentPort;
    parent?.postMessage({ type: "ready", port: actualPort });
  }
  console.log(`Viewer bridge: http://127.0.0.1:${actualPort}`);
  void run();
});
function stop() {
  stopping = true;
  adapter?.close();
  for (const ws of wss.clients) ws.close();
  wss.close();
  server.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
