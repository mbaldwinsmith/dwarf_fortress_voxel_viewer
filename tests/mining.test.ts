import { it, expect, vi } from "vitest";
import net from "node:net";
import { once } from "node:events";
import * as THREE from "three";
import {
  MiningHold,
  miningOperation,
  parseMiningRequest,
  validMiningTile,
  MINING_DELAY_MS,
  type MiningRequest,
} from "../src/shared/mining.js";
import { mineTile, miningArguments } from "../src/bridge/mining.js";
import { miningLua } from "../src/bridge/mining-lua.js";
import { Rpc } from "../src/bridge/rpc.js";
import { Frames, frame } from "../src/bridge/framing.js";
import { type } from "../src/bridge/protocol.js";
import type { FortressAdapter } from "../src/bridge/adapter.js";
import { SceneryReader } from "../src/bridge/scenery.js";
import { FirstPersonControls } from "../src/viewer/first-person.js";
import { FortressScene } from "../src/viewer/scene.js";
import type { Chunk } from "../src/shared/model.js";
const bounds = { x: 0, y: 0, z: 0, width: 64, depth: 64, height: 20 };
const request: MiningRequest = {
  type: "mining",
  session: "world",
  id: 1,
  mode: "dig",
  operation: "mine",
  x: 16,
  y: 16,
  z: 4,
};
const block = (x = 16, y = 16, z = 4): Chunk => ({
  x,
  y,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "wall",
    material: 2,
    name: "Rock",
  })),
});
it("accepts only bounded single-tile operations in the current session", () => {
  expect(parseMiningRequest(request, bounds, "world")).toBe(request);
  for (const change of [
    { session: "old" },
    { id: 0 },
    { mode: "eval" },
    { operation: "os.execute('x')" },
    { x: 0 },
    { y: 64 },
    { z: 20 },
    { z: 1.5 },
  ])
    expect(
      parseMiningRequest({ ...request, ...change }, bounds, "world"),
    ).toBeUndefined();
  const c = block(),
    chunks = new Map([["16,16,4", c]]);
  expect(validMiningTile(chunks, request)).toBe(true);
  for (const tile of [
    { shape: "unknown", material: 0, name: "Hidden" },
    { shape: "wall", material: 7, name: "Construction" },
    {
      shape: "wall",
      material: 23,
      name: "Tree",
      treeGraphic: "TREE_TRUNK_PILLAR",
    },
  ]) {
    c.tiles[0] = tile as Chunk["tiles"][number];
    expect(validMiningTile(chunks, request)).toBe(false);
  }
});
it("targets ramp removal from every face while keeping floor channeling and ceiling digging", () => {
  for (const normalY of [-1, 0, 0.7, 1])
    expect(miningOperation("ramp", normalY)).toBe("remove-ramp");
  expect(miningOperation("floor", 1)).toBe("channel");
  expect(miningOperation("wall", -1)).toBe("ceiling");
  expect(miningOperation("wall", 0)).toBe("mine");
  const r: MiningRequest = { ...request, operation: "remove-ramp" },
    c = block();
  expect(parseMiningRequest(r, bounds, "world")).toBe(r);
  const chunks = new Map([["16,16,4", c]]);
  expect(validMiningTile(chunks, r)).toBe(false);
  c.tiles[0].shape = "ramp";
  expect(validMiningTile(chunks, r)).toBe(true);
  c.tiles[0].material = 7;
  expect(validMiningTile(chunks, r)).toBe(false);
});
it("targets stairs for removal from every face and accepts only staircase removal targets", () => {
  for (const normalY of [-1, 0, 0.7, 1])
    expect(miningOperation("stairs", normalY)).toBe("remove-stairs");
  const r: MiningRequest = { ...request, operation: "remove-stairs" },
    c = block(),
    chunks = new Map([["16,16,4", c]]);
  expect(parseMiningRequest(r, bounds, "world")).toBe(r);
  for (const shape of ["floor", "wall", "ramp", "unknown"] as const) {
    c.tiles[0].shape = shape;
    expect(validMiningTile(chunks, r)).toBe(false);
  }
  c.tiles[0].shape = "stairs";
  expect(validMiningTile(chunks, r)).toBe(true);
  c.tiles[0].material = 7;
  expect(validMiningTile(chunks, r)).toBe(false);
});
it("picks stairs through gaps between treads, without picking through closer terrain", () => {
  const c = block(0, 0, 4),
    below = block(0, 0, 3),
    above = block(0, 0, 5);
  c.tiles[8 * 16 + 8].shape = "stairs";
  below.tiles.forEach((t) => (t.shape = "floor"));
  above.tiles.forEach((t) => (t.shape = "floor"));
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.12, 1),
    new THREE.MeshBasicMaterial(),
  );
  floor.position.set(8.5, 3.06, 8.5);
  floor.userData.chunkKey = "0,0,3";
  floor.updateMatrixWorld();
  const tread = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.5, 1),
    new THREE.MeshBasicMaterial(),
  );
  tread.position.set(8.125, 4.25, 8.5);
  tread.userData.chunkKey = "0,0,4";
  tread.updateMatrixWorld();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(8.5, 6, 8.5);
  camera.lookAt(8.5, 3, 8.5);
  camera.updateMatrixWorld();
  const context = {
    navigation: "orbit",
    miningMode: "dig",
    miningPointer: { x: 50, y: 50 },
    camera,
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
        }),
      },
    },
    meshes: new Map([
      ["0,0,3", floor],
      ["0,0,4", tread],
    ]),
    state: {
      chunks: new Map([
        ["0,0,3", below],
        ["0,0,4", c],
        ["0,0,5", above],
      ]),
    },
  };
  const pick = (
    FortressScene.prototype as unknown as {
      miningTarget: () => { target: MiningRequest } | undefined;
    }
  ).miningTarget;
  expect(pick.call(context)?.target).toEqual({
    x: 8,
    y: 8,
    z: 4,
    operation: "remove-stairs",
  });
  const cover = floor.clone();
  cover.position.y = 5.06;
  cover.userData.chunkKey = "0,0,5";
  cover.updateMatrixWorld();
  context.meshes.set("0,0,5", cover);
  expect(pick.call(context)?.target).toEqual({
    x: 8,
    y: 8,
    z: 5,
    operation: "channel",
  });
  floor.geometry.dispose();
  tread.geometry.dispose();
  floor.material.dispose();
  tread.material.dispose();
});
it("completes a hold after 750 ms and cancels on a different target or release", () => {
  const hold = new MiningHold();
  hold.begin(request, 100);
  expect(hold.progress(request, 100 + MINING_DELAY_MS / 2)).toBe(0.5);
  expect(hold.progress(request, 100 + MINING_DELAY_MS)).toBe(1);
  hold.begin(request, 100);
  expect(hold.progress({ ...request, x: 17 }, 900)).toBe(0);
  expect(hold.active).toBe(false);
  hold.begin(request, 100);
  hold.cancel();
  expect(hold.progress(request, 900)).toBe(0);
});
it("accepts bounded designation rectangles in either direction, never instant dig rectangles", () => {
  const r = { ...request, mode: "designate", x2: 35, y2: 40 };
  expect(parseMiningRequest(r, bounds, "world")).toBe(r);
  expect(
    parseMiningRequest({ ...r, x2: 2, y2: 2 }, bounds, "world"),
  ).toBeDefined();
  for (const change of [
    { mode: "dig" },
    { y2: undefined },
    { x2: 1.5 },
    { x2: 64 },
    { x2: 63, y2: 63 },
  ])
    expect(
      parseMiningRequest({ ...r, ...change }, bounds, "world"),
    ).toBeUndefined();
});
function adapter(state: "DUG" | "DESIGNATED" = "DUG") {
  return {
    bounds,
    identity: JSON.stringify({ saveName: "a'quoted-save" }),
    checkWorld: vi.fn(async () => {}),
    block: vi.fn(async () => block()),
    column: vi.fn(async (x: number, y: number, levels: number[]) =>
      levels.map((z) => block(x, y, z)),
    ),
    rpc: {
      mining: vi
        .fn()
        .mockResolvedValueOnce({ state: "READY", tiletype: 436 })
        .mockResolvedValueOnce({ state, tiletype: 436 }),
    },
  };
}
it("preflights and revalidates a fixed dig, then refreshes only the surrounding 27 blocks", async () => {
  const a = adapter();
  const result = await mineTile(
    a as unknown as FortressAdapter,
    request,
    () => true,
  );
  expect(a.rpc.mining.mock.calls).toEqual([
    [miningArguments(request, "a'quoted-save", true)],
    [miningArguments(request, "a'quoted-save", false, 436)],
  ]);
  expect(result.state).toBe("DUG");
  expect(result.chunks).toHaveLength(27);
  expect(a.column).toHaveBeenCalledTimes(9);
  expect(
    result.chunks.every(
      (c) =>
        Math.abs(c.x - 16) <= 16 &&
        Math.abs(c.y - 16) <= 16 &&
        Math.abs(c.z - 4) <= 1,
    ),
  ).toBe(true);
});
it("keeps designation mode separate and cancels before mutation if the client/session changed", async () => {
  const a = adapter("DESIGNATED");
  await mineTile(
    a as unknown as FortressAdapter,
    { ...request, mode: "designate" },
    () => true,
  );
  expect(a.rpc.mining.mock.calls[1][0][4]).toBe("designate");
  const cancelled = adapter();
  await expect(
    mineTile(cancelled as unknown as FortressAdapter, request, () => false),
  ).rejects.toThrow();
  expect(cancelled.rpc.mining).toHaveBeenCalledTimes(1);
  expect(cancelled.rpc.mining.mock.calls[0][0][6]).toBe("true");
  const changed = adapter();
  changed.checkWorld.mockRejectedValueOnce(Error("World changed"));
  await expect(
    mineTile(changed as unknown as FortressAdapter, request, () => true),
  ).rejects.toThrow("World changed");
  expect(changed.rpc.mining).not.toHaveBeenCalled();
});
it("batches rectangle designations and refreshes just their intersecting columns on one level", async () => {
  const a = adapter("DESIGNATED");
  const r: MiningRequest = { ...request, mode: "designate", x2: 35, y2: 2 };
  const result = await mineTile(a as unknown as FortressAdapter, r, () => true);
  expect(a.rpc.mining.mock.calls[1][0].slice(8)).toEqual(["35", "2"]);
  expect(a.column.mock.calls).toEqual([
    [16, 16, [4]],
    [16, 0, [4]],
    [32, 16, [4]],
    [32, 0, [4]],
  ]);
  expect(result.state).toBe("DESIGNATED");
  expect(result.count).toBe(436);
  expect(result.chunks).toHaveLength(4);
});
it("publishes the edited column before waiting for neighbours and stops publishing on a world change", async () => {
  const a = adapter();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  a.column.mockImplementation(async (x, y, levels) => {
    if (x !== 16 || y !== 16) await gate;
    return levels.map((z) => block(x, y, z));
  });
  const refreshed = vi.fn();
  const finished = mineTile(
    a as unknown as FortressAdapter,
    request,
    () => true,
    refreshed,
  );
  await vi.waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
  expect(refreshed.mock.calls[0][0].map((c: Chunk) => [c.x, c.y, c.z])).toEqual(
    [
      [16, 16, 4],
      [16, 16, 3],
      [16, 16, 5],
    ],
  );
  expect(a.block).not.toHaveBeenCalled();
  release();
  await finished;
  expect(refreshed).toHaveBeenCalledTimes(9);
  const changed = adapter(),
    published = vi.fn();
  // The fourth identity check is immediately after the first refreshed column.
  changed.checkWorld.mockImplementation(async () => {
    if (changed.checkWorld.mock.calls.length === 4)
      throw Error("World changed");
  });
  await expect(
    mineTile(
      changed as unknown as FortressAdapter,
      request,
      () => true,
      published,
    ),
  ).rejects.toThrow("World changed");
  expect(published).not.toHaveBeenCalled();
});
it("moves mining geometry ahead of a mesh backlog without letting later normal updates displace it", () => {
  const queue = {
    dirty: new Set(["160,160,4", "16,16,4", "176,160,4"]),
    flows: { update: vi.fn() },
  };
  FortressScene.prototype.update.call(
    queue as unknown as FortressScene,
    [block()],
    true,
  );
  expect([...queue.dirty][0]).toBe("16,16,4");
  expect(queue.dirty.has("160,160,4")).toBe(true);
  expect(queue.dirty.has("16,16,3")).toBe(true);
  FortressScene.prototype.update.call(queue as unknown as FortressScene, [
    block(0, 0, 4),
  ]);
  expect([...queue.dirty][0]).toBe("16,16,4");
  expect(queue.dirty.has("176,160,4")).toBe(true);
});
it("uses only the fixed Lua command over core RPC and decodes fragmented command results", async () => {
  let calls = 0;
  const server = net.createServer((socket) => {
    let handshake = Buffer.alloc(0),
      ready = false;
    const frames = new Frames();
    socket.on("data", (data) => {
      if (!ready) {
        handshake = Buffer.concat([handshake, data]);
        if (handshake.length < 12) return;
        ready = true;
        const h = Buffer.alloc(12);
        h.write("DFHack!\n");
        h.writeInt32LE(1, 8);
        socket.write(h);
        data = handshake.subarray(12);
      }
      for (const f of frames.push(data)) {
        expect(f.id).toBe(1);
        const input = type("dfproto.CoreRunCommandRequest"),
          decoded = input.toObject(input.decode(f.body));
        expect(decoded.command).toBe("lua");
        expect((decoded.arguments as string[])[0]).toBe(miningLua);
        expect((decoded.arguments as string[])[6]).toBe("a'quoted-save");
        const text = type("dfproto.CoreTextNotification")
          .encode({
            fragments: [
              { text: "DEEPWATCH_MINING:" },
              { text: ++calls === 1 ? "READY:436\n" : "ERROR:Tile changed\n" },
            ],
          })
          .finish();
        const output = Buffer.concat([frame(-3, text), frame(-1)]);
        socket.write(output.subarray(0, 11));
        socket.write(output.subarray(11));
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const rpc = new Rpc((server.address() as net.AddressInfo).port);
  try {
    await rpc.connect();
    expect(
      await rpc.mining(miningArguments(request, "a'quoted-save", true)),
    ).toEqual({ state: "READY", tiletype: 436 });
    await expect(
      rpc.mining(miningArguments(request, "a'quoted-save", false, 436)),
    ).rejects.toThrow("Tile changed");
  } finally {
    rpc.close();
    server.close();
  }
});
it("renders only revealed native designations and keeps them through item-only updates", async () => {
  const c = block();
  c.tiles[0] = { shape: "unknown", material: 0, name: "Hidden" };
  c.tiles[1].shape = "floor";
  const sprite = {
    asset: "a".repeat(24),
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    pageWidth: 32,
    pageHeight: 32,
  };
  const reader = new SceneryReader(
    { call: vi.fn(async () => ({ plantList: [] })) } as unknown as Rpc,
    { get: () => sprite } as never,
    bounds,
  );
  const dig = Array(256).fill(0);
  dig[0] = 1;
  dig[1] = 3;
  dig[2] = 1;
  await reader.decorate(c, { tileDigDesignation: dig });
  const ids = c.objects?.filter((o) => o.id.startsWith("d:")).map((o) => o.id);
  expect(ids).toEqual(["d:17:16:4", "d:18:16:4"]);
  expect(
    reader
      .withItems(c, undefined)
      .objects?.filter((o) => o.id.startsWith("d:"))
      .map((o) => o.id),
  ).toEqual(ids);
});
it("distinguishes gathering and chopping from mining despite their shared Default designation", async () => {
  const c = block();
  c.tiles[0] = { shape: "floor", material: 12, name: "Shrub" };
  c.tiles[1] = { shape: "floor", material: 12, name: "ShrubDead" };
  c.tiles[2] = {
    shape: "wall",
    material: 12,
    name: "TreeTrunkPillar",
    treeGraphic: "TREE_TRUNK_PILLAR",
  };
  c.tiles[3] = { shape: "wall", material: 2, name: "Stone wall" };
  c.tiles[4] = { shape: "floor", material: 2, name: "Stone floor" };
  c.tiles[5] = { shape: "unknown", material: 0, name: "Undiscovered" };
  const tokens = new Map<string, string>(),
    get = vi.fn((token: string) => {
      const asset = String(tokens.size).padStart(24, "0");
      tokens.set(asset, token);
      return {
        asset,
        x: 0,
        y: 0,
        width: 32,
        height: 32,
        pageWidth: 32,
        pageHeight: 32,
      };
    });
  const reader = new SceneryReader(
    { call: vi.fn(async () => ({ plantList: [] })) } as unknown as Rpc,
    { get } as never,
    bounds,
  );
  const dig = Array(256).fill(0);
  for (let i = 0; i < 6; i++) dig[i] = i === 4 ? 3 : 1;
  await reader.decorate(c, { tileDigDesignation: dig });
  const designations = c.objects!.filter((o) => o.id.startsWith("d:"));
  expect(designations.map((o) => tokens.get(o.sprite!.asset))).toEqual([
    "DESIGNATION_GATHER",
    "DESIGNATION_GATHER",
    "DESIGNATION_CHOP",
    "DESIGNATION_DIG_STANDARD",
    "DESIGNATION_DIG_CHANNEL",
  ]);
  expect(designations.map((o) => o.name)).toEqual([
    "Plant gathering designation",
    "Plant gathering designation",
    "Tree chopping designation",
    "Mining designation",
    "Mining designation",
  ]);
  expect(
    reader
      .withItems(c, undefined)
      .objects!.filter((o) => o.id.startsWith("d:")),
  ).toEqual(designations);
});
it("settles the first-person camera onto loaded ground after its supporting floor is channeled", async () => {
  const win = new EventTarget(),
    doc = Object.assign(new EventTarget(), {
      activeElement: null as unknown,
      pointerLockElement: null,
      exitPointerLock: () => {},
    });
  class Canvas extends EventTarget {
    focus() {
      doc.activeElement = this;
    }
    requestPointerLock() {
      return Promise.reject(Error("No capture"));
    }
  }
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  const camera = new THREE.PerspectiveCamera(),
    upper = block(0, 0, 4),
    lower = block(0, 0, 3),
    roof = block(0, 0, 5);
  upper.tiles.forEach((t) => (t.shape = "floor"));
  lower.tiles.forEach((t) => (t.shape = "floor"));
  roof.tiles.forEach((t) => (t.shape = "empty"));
  const chunks = new Map([upper, lower, roof].map((c) => [`0,0,${c.z}`, c])),
    controls = new FirstPersonControls(
      new Canvas() as unknown as HTMLCanvasElement,
      camera,
      () => chunks,
    );
  try {
    controls.enter(3.5, 3.5, 4);
    await Promise.resolve();
    upper.tiles[51].shape = "empty";
    const changed = vi.fn();
    controls.onLevelChange = changed;
    for (let i = 0; i < 10; i++) controls.update(0.05);
    expect(camera.position.y).toBeCloseTo(3.76);
    expect(changed).toHaveBeenCalledWith(3);
  } finally {
    controls.dispose();
    vi.unstubAllGlobals();
  }
});
