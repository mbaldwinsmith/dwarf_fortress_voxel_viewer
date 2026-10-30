import { expect, it } from "vitest";
import { packChunk, wireMessage } from "../src/shared/chunk-codec.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { ChunkCache } from "../src/bridge/chunk-cache.js";
import { indexAttributes } from "../src/viewer/indexed-geometry.js";
import { RenderScheduler } from "../src/viewer/render-scheduler.js";
import { Frames, frame } from "../src/bridge/framing.js";
import {
  atlasRect,
  ATLAS_HEIGHT,
  ATLAS_WIDTH,
} from "../src/viewer/terrain-atlas.js";
import type { Chunk, ServerMessage } from "../src/shared/model.js";

const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Granite floor",
  })),
});
const message = (c: Chunk): ServerMessage => ({
  type: "chunks",
  session: "a",
  sequence: 1,
  pollMs: 0,
  chunks: [c],
});
it("losslessly palettes repeated tiles, shares decoded cells, and preserves hidden checks", () => {
  const c = chunk();
  c.tiles[1] = { shape: "unknown", material: 0, name: "Hidden" };
  const wire = JSON.stringify(wireMessage(message(c)));
  const parsed = parseServerMessage(JSON.parse(wire));
  expect(parsed).toEqual(message(c));
  if (parsed.type !== "chunks") throw Error("wrong message");
  expect(parsed.chunks[0].tiles[0]).toBe(parsed.chunks[0].tiles[2]);
  expect(wire.length).toBeLessThan(JSON.stringify(message(c)).length / 5);
  const hidden = JSON.parse(wire);
  hidden.chunks[0].objects = [
    { id: "i:1", x: 1, y: 0, z: 4, kind: "ground", name: "Hidden item" },
  ];
  expect(() => parseServerMessage(hidden)).toThrow(/Hidden/);
});
it("bounds palette expansion and rejects invalid entries, indices and conflicting encodings", () => {
  const wire = JSON.parse(JSON.stringify(wireMessage(message(chunk()))));
  for (const change of [
    { tilePalette: [] },
    { tilePalette: Array(257).fill({}) },
    { tileIndices: Array(255).fill(0) },
    { tileIndices: Array(256).fill(-1) },
    { tileIndices: Array(256).fill(0.5) },
    { tileIndices: Array(256).fill(1) },
    { tiles: chunk().tiles },
    { tilePalette: [{ shape: "oops" }] },
  ])
    expect(() =>
      parseServerMessage({
        ...wire,
        chunks: [{ ...wire.chunks[0], ...change }],
      }),
    ).toThrow();
  const unique = chunk();
  unique.tiles.forEach((t, i) => (t.name += i));
  expect(packChunk(unique)).toBe(unique);
});
it("terrain stamps survive scenery-only changes and detect all terrain fields", () => {
  const cache = new ChunkCache(),
    c = chunk();
  cache.store(c, 0);
  const stamp = c.terrainStamp;
  const items = { ...c, objects: [] };
  expect(cache.updateItems(items)).toBe(true);
  expect(items.terrainStamp).toBe(stamp);
  expect(cache.fresh("0,0,4", 2100)).toBe(false);
  expect(cache.store(structuredClone(items), 3000)).toBe(false);
  for (const field of ["tiles", "flows", "ceilingTexture"]) {
    const next = structuredClone(c);
    if (field === "tiles") next.tiles[0].name = "Changed";
    if (field === "flows") next.flows = [];
    if (field === "ceilingTexture")
      next.ceilingTexture = {
        asset: "a".repeat(24),
        x: 0,
        y: 0,
        width: 32,
        height: 32,
        pageWidth: 32,
        pageHeight: 32,
      };
    cache.store(next, 4000);
    expect(next.terrainStamp).not.toBe(stamp);
  }
});
it("indexes identical vertices bit-for-bit without merging texture or colour seams", () => {
  const position = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0,
  ]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const attributes = {
    position: { array: position, size: 3 },
    uv: { array: uv, size: 2 },
  };
  const result = indexAttributes(attributes);
  expect(result.index).toBeInstanceOf(Uint16Array);
  expect(result.attributes.position.array.length).toBe(12);
  for (const [key, a] of Object.entries(attributes)) {
    const packed = result.attributes[key as keyof typeof attributes];
    const expanded = new Float32Array(result.index!.length * a.size);
    result.index!.forEach((index, i) =>
      expanded.set(
        packed.array.subarray(index * a.size, (index + 1) * a.size),
        i * a.size,
      ),
    );
    expect(new Uint8Array(expanded.buffer)).toEqual(
      new Uint8Array(a.array.buffer),
    );
  }
  uv[6] = 0.5;
  expect(indexAttributes(attributes).attributes.position.array.length).toBe(15);
  expect(() =>
    indexAttributes({
      ...attributes,
      uv: { array: new Float32Array(3), size: 2 },
    }),
  ).toThrow();
});
it("uses 32-bit indices when needed and avoids buffers that would increase memory", () => {
  const array = new Float32Array(70000 * 6);
  for (let i = 0; i < 70000; i++) {
    array[i * 3] = i;
    array[(i + 70000) * 3] = i;
  }
  const result = indexAttributes({ position: { array, size: 3 } });
  expect(result.index).toBeInstanceOf(Uint32Array);
  expect(result.index![69999]).toBe(69999);
  expect(result.index![139999]).toBe(69999);
  const unique = {
    position: { array: new Float32Array([0, 0, 0, 1, 1, 1]), size: 3 },
  };
  expect(indexAttributes(unique)).toEqual({ attributes: unique });
});
it("renders motion and invalidations immediately while throttling only quiet frames", () => {
  const scheduler = new RenderScheduler();
  expect(scheduler.take(0)).toBe(true);
  for (let i = 1; i < 250; i++) expect(scheduler.take(i)).toBe(false);
  expect(scheduler.take(250)).toBe(true);
  expect(scheduler.take(251, true)).toBe(true);
  expect(scheduler.take(252, true)).toBe(true);
  scheduler.invalidate();
  expect(scheduler.take(253)).toBe(true);
  expect(scheduler.take(254)).toBe(false);
});
it("reassembles a fragmented large frame once and continues through subsequent replies", () => {
  const payload = Buffer.alloc(256 * 1024);
  for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
  const wire = Buffer.concat([
    frame(-3, Buffer.from("log")),
    frame(-1, payload),
    frame(-1, Buffer.from("next")),
  ]);
  const parser = new Frames(),
    replies = [];
  for (let i = 0; i < wire.length; i += 31)
    replies.push(...parser.push(wire.subarray(i, i + 31)));
  expect(replies.map((r) => r.body.length)).toEqual([3, payload.length, 4]);
  expect(replies[1].body).toEqual(payload);
  expect(replies[2].body.toString()).toBe("next");
  expect(parser.push(Buffer.alloc(0))).toEqual([]);
  expect(frame(4).subarray(2, 4)).toEqual(Buffer.alloc(2));
});
it("keeps every atlas cell inside the reduced texture with half-texel gutters", () => {
  expect(ATLAS_WIDTH * ATLAS_HEIGHT * 4).toBe(8 * 1024 * 1024);
  for (let i = 0; i < 1024; i++) {
    const [l, b, r, t] = atlasRect(i);
    expect(l).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
    expect(t).toBeLessThan(1);
    expect((r - l) * ATLAS_WIDTH).toBeCloseTo(31);
    expect((t - b) * ATLAS_HEIGHT).toBeCloseTo(31);
  }
});
