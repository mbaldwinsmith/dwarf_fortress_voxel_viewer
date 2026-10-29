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
import { chunkKey, type Chunk, type ServerMessage } from "../shared/model.js";
import { inspectInstallation } from "./installation.js";
import { blockOrder, parseLevel, parseMode, screenRegion } from "./region.js";
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
for (const n of [port, dfPort, pollMs])
  if (!Number.isSafeInteger(n) || n < 1 || n > 65535)
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
const root = path.resolve("dist/viewer");
const server = http.createServer(async (req, res) => {
  try {
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
const chunks = new Map<string, Chunk>();
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
      requestedMode = mode;
      return;
    }
    const level = parseLevel(data.toString(), reset?.bounds);
    if (level === undefined) {
      ws.close(1008, "Invalid viewer operation");
      return;
    }
    requestedLevel = level;
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
      chunks.clear();
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
      const creatures = new CreatureReader(adapter, graphics);
      let creatureTick = 0,
        lastCreaturePoll = 0;
      let sweep = 0;
      while (!stopping && wss.clients.size) {
        const mode = requestedMode;
        const region =
          mode === "screen"
            ? screenRegion(
                adapter.bounds,
                await adapter.rpc.call("GetViewInfo"),
              )
            : { bounds: adapter.bounds, level: requestedLevel };
        const b = region.bounds,
          level = region.level;
        requestedLevel = level;
        if (
          reset.level !== level ||
          reset.mode !== mode ||
          JSON.stringify(reset.bounds) !== JSON.stringify(b)
        ) {
          session = randomUUID();
          chunks.clear();
          sequence = 0;
          reset = { ...reset, session, level, bounds: b, mode };
          publish(reset);
        }
        const started = performance.now();
        await adapter.checkWorld();
        let changed = 0,
          completed = 0;
        const order = blockOrder(b, level);
        for (const [x, y, z] of order) {
          if (
            stopping ||
            !wss.clients.size ||
            requestedLevel !== level ||
            requestedMode !== mode
          )
            break;
          if (mode === "screen" && completed % 12 === 0) {
            const current = screenRegion(
              adapter.bounds,
              await adapter.rpc.call("GetViewInfo"),
            );
            if (
              current.level !== level ||
              JSON.stringify(current.bounds) !== JSON.stringify(b)
            )
              break;
          }
          await adapter.checkWorld();
          const t = performance.now(),
            chunk = await adapter.block(x, y, z),
            k = chunkKey(chunk);
          await adapter.checkWorld();
          if (requestedLevel !== level) break;
          if (JSON.stringify(chunks.get(k)) !== JSON.stringify(chunk)) {
            chunks.set(k, chunk);
            publish({
              type: "chunks",
              session,
              sequence: ++sequence,
              chunks: [chunk],
              pollMs: Math.round(performance.now() - t),
            });
            changed++;
          }
          if (performance.now() - lastCreaturePoll >= 1000) {
            const snapshot = await creatures.snapshot(b, level, chunks);
            await adapter.checkWorld();
            if (requestedMode === mode && requestedLevel === level)
              publish({
                type: "creatures",
                session,
                tick: ++creatureTick,
                creatures: snapshot,
              });
            lastCreaturePoll = performance.now();
          }
          completed++;
          if (completed % 12 === 0)
            setStatus(
              `Streaming Z ${level} · ${completed}/${order.length} blocks · sweep ${sweep + 1}`,
            );
          await pause(pollMs);
        }
        if (requestedLevel !== level) continue;
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
      }
    } catch (e) {
      reset = undefined;
      chunks.clear();
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
  console.log(`Viewer bridge: http://127.0.0.1:${port}`);
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
