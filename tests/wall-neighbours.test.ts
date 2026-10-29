import { it, expect } from "vitest";
import { wallTileSuffixes } from "../src/bridge/wall-tiles.js";
import { maskEnclosedWalls } from "../src/bridge/wall-visibility.js";
import { textureTerrain } from "../src/bridge/terrain-art.js";
import { buildMesh } from "../src/viewer/mesh.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const ref: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 64,
  pageHeight: 32,
};
const c = (): Chunk => ({
  x: 0,
  y: 0,
  z: 3,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "wall",
    material: 2,
    name: "Stone",
  })),
});
it("selects native exposed-edge, corner, junction and isolated-pillar tokens", () => {
  for (const [mask, expected] of [
    [0, []],
    [1, ["N"]],
    [2, ["S"]],
    [4, ["W"]],
    [8, ["E"]],
    [1 | 4, ["N_W"]],
    [1 | 2, ["N_S"]],
    [1 | 2 | 8, ["N_S_E"]],
    [15, ["N_S_W_E"]],
    [16, ["NW"]],
    [32, ["NE"]],
    [1 | 32, ["N"]],
    [1 | 64, ["N", "SW"]],
    [16 | 128, ["NW", "SE"]],
  ] as [number, string[]][])
    expect(wallTileSuffixes(mask)).toEqual(expected);
});
it("computes eight-neighbour exposure within chunks and at diagonal chunk corners", () => {
  const chunk = c();
  chunk.tiles[7 * 16 + 7] = { shape: "floor", material: 2, name: "Floor" };
  maskEnclosedWalls(chunk);
  expect(chunk.tiles[8 * 16 + 8].wallMask).toBe(16);
  expect(chunk.tiles[8 * 16 + 7].wallMask).toBe(1);
  expect(chunk.tiles[7 * 16 + 8].wallMask).toBe(4);
  expect(chunk.tiles[0].sealed).toBe(true);
  const boundary = c();
  maskEnclosedWalls(boundary, (x, y) => x === 16 && y === 16);
  expect(boundary.tiles[255].wallMask).toBe(128);
  expect(boundary.tiles[255].sealed).toBeUndefined();
});
it("resolves directional material/finish art instead of using the all-edges sprite everywhere", () => {
  for (const [material, smooth, prefix] of [
    [2, false, "STONE_WALL"],
    [2, true, "SMOOTHED_STONE_WALL"],
    [1, false, "SOIL_WALL"],
    [7, false, "WOODEN_WALL"],
  ] as const) {
    const chunk = c();
    chunk.tiles[0] = {
      shape: "wall",
      material,
      name: "Wall",
      smooth: smooth ? true : undefined,
      wallMask: 1 | 4,
    };
    const requested: string[] = [];
    textureTerrain(
      chunk,
      {
        get: (key) => {
          requested.push(key);
          return ref;
        },
      },
      [{ matType: material === 7 ? 419 : 0, matIndex: 0 }],
    );
    expect(requested.some((k) => k.startsWith(`${prefix}_N_W`))).toBe(true);
    expect(chunk.tiles[0].wallRim).toHaveLength(1);
  }
});
it("renders native alpha rims above the cap with material tint and transparent atlas sampling", () => {
  const chunk = c();
  chunk.tiles = Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  }));
  const rim = { ...ref, x: 32 };
  chunk.tiles[0] = {
    shape: "wall",
    material: 2,
    name: "Wall",
    color: [255, 0, 0],
    wallCap: ref,
    wallMask: 1,
    wallRim: [rim],
  };
  const calls: { ref?: SpriteRef; transparent?: boolean }[] = [];
  const mesh = buildMesh(
    chunk,
    new Map([["0,0,3", chunk]]),
    3,
    (ref, transparent) => {
      calls.push({ ref, transparent });
      return [0, 0, 1, 1];
    },
  );
  expect(calls.some((c) => c.ref === rim && c.transparent === true)).toBe(true);
  expect(calls.some((c) => c.ref === ref && !c.transparent)).toBe(true);
  const y = mesh.positions.filter((_, i) => i % 3 === 1);
  expect(Math.max(...y)).toBeCloseTo(4.004);
  expect(mesh.positions.length).toBe(7 * 18);
});
