import { it, expect } from "vitest";
import { textureTerrain } from "../src/bridge/terrain-art.js";
import { buildMesh } from "../src/viewer/mesh.js";
import { atlasRect } from "../src/viewer/terrain-atlas.js";
import { parseServerMessage } from "../src/shared/validation.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const ref: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 32,
  pageHeight: 32,
};
const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 3,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
it("chooses rough/smooth stone, soil, grass, ice and construction wood textures", () => {
  const c = chunk();
  const names: string[] = [];
  const art = {
    get: (key: string) => {
      names.push(key);
      return ref;
    },
  };
  c.tiles[0] = { shape: "wall", material: 2, name: "Wall" };
  c.tiles[1] = { shape: "floor", material: 2, name: "Floor", smooth: true };
  c.tiles[2] = { shape: "floor", material: 1, name: "Soil" };
  c.tiles[3] = { shape: "floor", material: 8, name: "Grass" };
  c.tiles[4] = { shape: "floor", material: 6, name: "Ice" };
  c.tiles[5] = { shape: "floor", material: 7, name: "Wood floor" };
  const mats = Array(256).fill({ matType: 0, matIndex: 0 });
  mats[5] = { matType: 419, matIndex: 1 };
  textureTerrain(c, art, mats);
  for (const key of [
    "SMOOTH_FLOOR",
    "DIRT_FLOOR_5",
    "GRASS_5",
    "ROUGH_ICE_FLOOR",
    "WOOD_FLOOR",
  ])
    expect(names).toContain(key);
  expect(names.some((k) => /^STONE_WALL_N_S_W_E_[1-4]$/.test(k))).toBe(true);
  expect(c.tiles.slice(0, 6).every((t) => t.surfaces?.top === ref)).toBe(true);
});
it("leaves hidden tiles and unavailable local art flat", () => {
  const c = chunk();
  c.tiles[0] = { shape: "unknown", material: 0, name: "Undiscovered" };
  c.tiles[1] = { shape: "floor", material: 2, name: "Floor" };
  textureTerrain(c, { get: () => undefined });
  expect(c.tiles[0].surfaces).toBeUndefined();
  expect(c.tiles[1].surfaces).toBeUndefined();
  c.tiles[0].surfaces = { top: ref, side: ref };
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "s",
      sequence: 1,
      pollMs: 200,
      chunks: [c],
    }),
  ).toThrow();
});
it("emits a UV for every exposed wall and floor vertex without changing geometry", () => {
  const c = chunk();
  c.tiles[0] = {
    shape: "wall",
    material: 2,
    name: "Wall",
    surfaces: { top: ref, side: { ...ref, x: 32, pageWidth: 64 } },
  };
  const all = new Map([["0,0,3", c]]),
    requests: (SpriteRef | undefined)[] = [];
  const mesh = buildMesh(c, all, 3, (r) => {
    requests.push(r);
    return [0.1, 0.2, 0.3, 0.4];
  });
  expect(mesh.uvs).toHaveLength((mesh.positions.length / 3) * 2);
  expect(requests).toContain(ref);
  expect(requests).toContain(c.tiles[0].surfaces!.side);
  const geometry = [...mesh.positions];
  delete c.tiles[0].surfaces;
  expect(buildMesh(c, all, 3).positions).toEqual(geometry);
});
it("allocates separated atlas cells within bounds with an untextured fallback cell", () => {
  for (const slot of [0, 1, 59, 60, 1023]) {
    const [l, b, r, t] = atlasRect(slot);
    expect(l).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
    expect(t).toBeLessThan(1);
    expect(r).toBeGreaterThan(l);
    expect(t).toBeGreaterThan(b);
  }
  expect(atlasRect(1)[0]).toBeGreaterThan(atlasRect(0)[2]);
});
