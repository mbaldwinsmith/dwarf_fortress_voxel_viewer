import { it, expect, vi, beforeEach } from "vitest";
vi.mock("../src/bridge/rpc.js", () => ({
  Rpc: class {
    call = vi.fn();
    engravings = vi.fn().mockResolvedValue([]);
    close = vi.fn();
  },
}));
import { FortressAdapter } from "../src/bridge/adapter.js";
import { SceneryReader } from "../src/bridge/scenery.js";
import { ChunkCache } from "../src/bridge/chunk-cache.js";
import { blockOrder, columnBatches } from "../src/bridge/region.js";
import type { Chunk } from "../src/shared/model.js";
const bounds = { x: 0, y: 0, z: 0, width: 192, depth: 192, height: 199 };
const air = (z: number): Chunk => ({
  x: 16,
  y: 32,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
const raw = (z: number) => ({
  mapX: 16,
  mapY: 32,
  mapZ: z,
  tiles: Array(256).fill(1),
  hidden: Array(256).fill(false),
});
let adapter: FortressAdapter;
beforeEach(() => {
  adapter = new FortressAdapter(0);
  adapter.defs.set(1, { shape: 1, material: 2, name: "Floor" });
});
it("replaces loose items after hauling or pickup while retaining furniture, plants and terrain", async () => {
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
    adapter.rpc,
    { get: () => sprite } as never,
    bounds,
  );
  vi.mocked(adapter.rpc.call)
    .mockResolvedValueOnce({
      materialList: [{ matPair: { matType: 4, matIndex: -1 }, id: "BOULDER" }],
    })
    .mockResolvedValue({});
  await reader.initialize();
  const chunk = air(10);
  chunk.tiles.forEach((t) => (t.shape = "floor"));
  chunk.objects = ["b:1", "p:1", "s:1", "i:7"].map((id) => ({
    id,
    x: 16,
    y: 32,
    z: 10,
    kind: "ground",
    name: id,
  }));
  const item = {
    id: 9,
    pos: { x: 16, y: 32, z: 10 },
    flags1: 1,
    type: { matType: 4, matIndex: -1 },
  };
  const moved = reader.withItems(chunk, [item]);
  expect(moved.objects?.map((o) => o.id)).toEqual(["b:1", "p:1", "s:1", "i:9"]);
  expect(moved.tiles).toBe(chunk.tiles);
  expect(reader.withItems(moved, undefined).objects?.map((o) => o.id)).toEqual([
    "b:1",
    "p:1",
    "s:1",
  ]);
  expect(
    reader
      .withItems(moved, [{ ...item, flags1: 1 | (1 << 3) }])
      .objects?.map((o) => o.id),
  ).toEqual(["b:1", "p:1", "s:1"]);
  chunk.tiles[0].shape = "unknown";
  expect(reader.withItems(chunk, [item]).objects?.map((o) => o.id)).toEqual([
    "b:1",
    "p:1",
    "s:1",
  ]);
});
it("decodes out-of-order native columns, omitted air and hidden tiles in one RPC", async () => {
  const hidden = raw(10);
  hidden.hidden[0] = true;
  vi.mocked(adapter.rpc.call).mockResolvedValue({
    mapBlocks: [raw(12), hidden],
  });
  const chunks = await adapter.column(16, 32, [11, 12, 10]);
  expect(adapter.rpc.call).toHaveBeenCalledTimes(1);
  expect(adapter.rpc.call).toHaveBeenCalledWith(
    "GetBlockList",
    expect.objectContaining({
      minZ: 10,
      maxZ: 13,
      blocksNeeded: 3,
      forceReload: true,
    }),
  );
  expect(chunks.map((c) => c.z)).toEqual([11, 12, 10]);
  expect(chunks[0].tiles.every((t) => t.shape === "empty")).toBe(true);
  expect(chunks[1].tiles[0].shape).toBe("floor");
  expect(chunks[2].tiles[0]).toEqual({
    shape: "unknown",
    material: 0,
    name: "Undiscovered",
  });
});
it("provides first-block building metadata to every requested level", async () => {
  const buildings = [{ index: 4, posZMax: 10 }];
  vi.mocked(adapter.rpc.call).mockResolvedValue({
    mapBlocks: [{ ...raw(12), buildings }, raw(10)],
  });
  const decorate = vi.fn(async () => {});
  adapter.scenery = { decorate } as never;
  await adapter.column(16, 32, [10, 11, 12]);
  expect(decorate).toHaveBeenCalledTimes(3);
  for (const [, value] of decorate.mock.calls as unknown as [
    Chunk,
    { buildings: unknown },
  ][])
    expect(value.buildings).toEqual(buildings);
});
it("rejects duplicate, foreign and oversized native columns", async () => {
  for (const list of [
    [raw(10), raw(10)],
    [{ ...raw(10), mapX: 32 }],
    [raw(9)],
  ]) {
    vi.mocked(adapter.rpc.call).mockResolvedValue({ mapBlocks: list });
    await expect(adapter.column(16, 32, [10, 11])).rejects.toThrow();
  }
  await expect(adapter.column(16, 32, [0, 16])).rejects.toThrow();
  await expect(adapter.column(17, 32, [10])).rejects.toThrow();
});
it("refreshes items from partial replies and clears departed items without replacing terrain", async () => {
  const first = air(10),
    second = air(11);
  const withItems = vi.fn((c: Chunk, items: unknown) => ({
    ...c,
    objects: [],
    testItems: items,
  }));
  adapter.scenery = { withItems } as never;
  vi.mocked(adapter.rpc.call).mockResolvedValue({
    mapBlocks: [{ mapX: 16, mapY: 32, mapZ: 10, items: [{ id: 7 }] }],
  });
  const result = await adapter.items([first, second]);
  expect(adapter.rpc.call).toHaveBeenCalledWith(
    "GetBlockList",
    expect.objectContaining({ blocksNeeded: 2, forceReload: false }),
  );
  expect(withItems.mock.calls).toEqual([
    [first, [{ id: 7 }]],
    [second, undefined],
  ]);
  expect(result[0].tiles).toBe(first.tiles);
  expect(result[1].tiles).toBe(second.tiles);
});
it("reuses recently departed levels, keeps item and terrain freshness separate, and clears sessions", () => {
  const cache = new ChunkCache();
  const c = air(10);
  expect(cache.store(c, 100)).toBe(true);
  cache.select(bounds, 16);
  expect(cache.active.size).toBe(0);
  expect(cache.restore("16,32,10")).toBe(c);
  expect(cache.fresh("16,32,10", 200)).toBe(true);
  cache.updateItems({ ...c, objects: [] });
  expect(cache.fresh("16,32,10", 2200)).toBe(false);
  cache.clear();
  expect(cache.restore("16,32,10")).toBeUndefined();
});
it("refreshes region-wide building states from the first partial block without replacing terrain", async () => {
  const first = air(10),
    second = air(11),
    buildings = [{ index: 7, active: 0 }];
  const withBuildings = vi.fn((c: Chunk, values: unknown) => ({
    ...c,
    testBuildings: values,
  }));
  const withItems = vi.fn((c: Chunk) => c);
  adapter.scenery = { withBuildings, withItems } as never;
  vi.mocked(adapter.rpc.call).mockResolvedValue({
    mapBlocks: [{ mapX: 16, mapY: 32, mapZ: 10, buildings }],
  });
  const result = await adapter.items([first, second]);
  expect(withBuildings.mock.calls).toEqual([
    [first, buildings],
    [second, buildings],
  ]);
  expect(result.map((c) => c.tiles)).toEqual([first.tiles, second.tiles]);
  vi.mocked(adapter.rpc.call).mockResolvedValue({ mapBlocks: [] });
  withBuildings.mockClear();
  await adapter.items([first, second]);
  expect(withBuildings).not.toHaveBeenCalled();
});
it("bounds the reserve and evicts least recently used inactive terrain", () => {
  const cache = new ChunkCache(2);
  cache.store(air(10), 0);
  cache.select(bounds, 30);
  cache.store(air(11), 0);
  cache.select(bounds, 30);
  cache.restore("16,32,10");
  cache.select(bounds, 30);
  cache.store(air(12), 0);
  cache.select(bounds, 30);
  expect(cache.restore("16,32,11")).toBeUndefined();
  expect(cache.restore("16,32,10")).toBeDefined();
  expect(cache.restore("16,32,12")).toBeDefined();
});
it("loads the 3x3 walking core before distant columns and covers the full window with bounded requests", () => {
  const order = blockOrder(bounds, 128, { x: 100, y: 100 });
  expect(
    order
      .slice(0, 45)
      .every(
        ([x, y, z]) =>
          Math.abs(x - 96) <= 16 &&
          Math.abs(y - 96) <= 16 &&
          Math.abs(z - 128) <= 2,
      ),
  ).toBe(true);
  expect(new Set(order.slice(0, 45).map((p) => p.join(","))).size).toBe(45);
  const batches = columnBatches(order);
  expect(batches.length).toBe(153);
  expect(
    batches.every((b) => Math.max(...b.levels) - Math.min(...b.levels) < 16),
  ).toBe(true);
  expect(batches.flatMap((b) => b.levels.map((z) => [b.x, b.y, z]))).toEqual(
    order,
  );
});
it("refreshes carvings independently of RFR hashes and clears removed or hidden records", async () => {
  adapter.defs.set(1, {
    shape: 1,
    material: 2,
    name: "Smooth floor",
    smooth: true,
  });
  const r = raw(10);
  r.hidden[1] = true;
  vi.mocked(adapter.rpc.call).mockResolvedValue({ mapBlocks: [r] });
  vi.mocked(adapter.rpc.engravings)
    .mockResolvedValueOnce([
      [16, 32, 10, 256],
      [17, 32, 10, 256],
    ])
    .mockResolvedValue([]);
  let c = (await adapter.column(16, 32, [10]))[0];
  expect(adapter.rpc.engravings).toHaveBeenCalledWith(16, 32, 10, 11);
  expect(c.tiles[0].engraving).toBe(256);
  expect(c.tiles[1].engraving).toBeUndefined();
  c = (await adapter.column(16, 32, [10]))[0];
  expect(c.tiles[0].engraving).toBeUndefined();
});
