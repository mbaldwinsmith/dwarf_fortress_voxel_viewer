import { it, expect } from "vitest";
import { maskEnclosedWalls } from "../src/bridge/wall-visibility.js";
import { textureTerrain, terrainMaterials } from "../src/bridge/terrain-art.js";
import {
  buildMesh,
  wallCapColor,
  linearMaterialColor,
} from "../src/viewer/mesh.js";
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
    shape: "wall",
    material: 5,
    name: "vein wall",
    materialName: "native gold",
    color: [255, 255, 0],
    surfaces: { top: ref, side: ref },
  })),
});
it("redacts enclosed ore names, colours, finish and material classes before transmission", () => {
  const c = chunk();
  maskEnclosedWalls(c);
  expect(c.tiles.every((t) => t.sealed)).toBe(true);
  expect(c.tiles[17]).toEqual({
    shape: "wall",
    material: 2,
    name: "Solid rock",
    sealed: true,
  });
  expect(JSON.stringify(c)).not.toContain("gold");
  expect(JSON.stringify(c)).not.toContain(ref.asset);
});
it("keeps only natural walls beside confirmed open revealed tiles exposed", () => {
  const c = chunk();
  c.tiles[136] = { shape: "floor", material: 2, name: "Floor" };
  c.tiles[100] = { shape: "unknown", material: 0, name: "Undiscovered" };
  maskEnclosedWalls(c);
  for (const i of [135, 137, 120, 152])
    expect(c.tiles[i].materialName).toBe("native gold");
  expect(c.tiles[99].sealed).toBe(true);
  expect(c.tiles[100].shape).toBe("unknown");
});
it("treats absent chunk neighbours as sealed and recovers edges on a later read", () => {
  const closed = chunk();
  maskEnclosedWalls(closed);
  expect(closed.tiles[8 * 16 + 15].sealed).toBe(true);
  const reread = chunk();
  maskEnclosedWalls(reread, (x, y, z) => x === 16 && y === 8 && z === 3);
  expect(reread.tiles[8 * 16 + 15].materialName).toBe("native gold");
  expect(reread.tiles[7 * 16 + 15].wallMask).toBe(128);
  expect(reread.tiles[6 * 16 + 15].sealed).toBe(true);
});
it("preserves constructed walls and tree art while leaving unknown cells redacted", () => {
  const c = chunk();
  c.tiles[0].material = 7;
  c.tiles[1].treeGraphic = "TREE_TRUNK_PILLAR";
  maskEnclosedWalls(c);
  expect(c.tiles[0].sealed).toBeUndefined();
  expect(c.tiles[1].treeGraphic).toBe("TREE_TRUNK_PILLAR");
});
it("does not rehydrate sealed ore from raw material pairs and rejects sealed metadata leaks", () => {
  const c = chunk();
  maskEnclosedWalls(c);
  const defs = terrainMaterials([
    {
      matPair: { matType: 0, matIndex: 1 },
      id: "GOLD",
      name: "gold",
      stateColor: { red: 255, green: 255, blue: 0 },
    },
  ]);
  textureTerrain(
    c,
    { get: () => ref },
    Array(256).fill({ matType: 0, matIndex: 1 }),
    { definitions: defs },
  );
  expect(c.tiles[0].color).toBeUndefined();
  expect(c.tiles[0].materialName).toBeUndefined();
  const message = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  expect(() => parseServerMessage(message())).not.toThrow();
  c.tiles[0].materialName = "gold";
  expect(() => parseServerMessage(message())).toThrow();
});
it("uses a uniform untextured cap regardless of ore while retaining exposed side colours", () => {
  const c = chunk();
  c.tiles = Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  }));
  c.tiles[0] = {
    shape: "wall",
    material: 5,
    name: "vein wall",
    color: [0, 255, 255],
    surfaces: { top: ref, side: ref },
  };
  const calls: (SpriteRef | undefined)[] = [];
  const mesh = buildMesh(c, new Map([["0,0,3", c]]), 3, (r) => {
    calls.push(r);
    return [0, 0, 1, 1];
  });
  let topTriangles = 0;
  for (let i = 0; i < mesh.positions.length; i += 9) {
    if ([1, 4, 7].every((j) => mesh.positions[i + j] === 4)) {
      topTriangles++;
      expect(mesh.colors.slice(i, i + 9)).toEqual([
        ...wallCapColor,
        ...wallCapColor,
        ...wallCapColor,
      ]);
    }
  }
  expect(topTriangles).toBe(2);
  expect(calls).toContain(undefined);
  expect(calls).toContain(ref);
  expect(mesh.colors.slice(0, 3)).toEqual(linearMaterialColor([0, 255, 255]));
});
it("keeps enclosed and undiscovered cap interiors uniform without material-dependent artwork", () => {
  const definitions = terrainMaterials([
    {
      matPair: { matType: 0, matIndex: 1 },
      id: "GOLD",
      name: "gold",
      stateColor: { red: 255, green: 255, blue: 0 },
    },
  ]);
  const c = chunk();
  maskEnclosedWalls(c);
  c.tiles[0] = { shape: "unknown", material: 0, name: "Undiscovered" };
  const requests: string[] = [];
  textureTerrain(
    c,
    {
      get: (key) => {
        requests.push(key);
        return ref;
      },
    },
    Array(256).fill({ matType: 0, matIndex: 1 }),
    { definitions },
  );
  expect(c.tiles[0].wallCap).toBeUndefined();
  expect(c.tiles[1].wallCap).toBeUndefined();
  expect(requests).toHaveLength(0);
  expect(c.tiles[1].materialName).toBeUndefined();
  expect(c.tiles[0].surfaces).toBeUndefined();
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "s",
      sequence: 1,
      pollMs: 200,
      chunks: [c],
    }),
  ).not.toThrow();
});
it("preserves authored colours of explicit cap artwork without an ore tint", () => {
  const c = chunk();
  c.tiles = Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  }));
  c.tiles[0] = {
    shape: "wall",
    material: 5,
    name: "vein wall",
    color: [255, 0, 255],
    wallCap: ref,
  };
  const requests: (SpriteRef | undefined)[] = [];
  const mesh = buildMesh(c, new Map([["0,0,3", c]]), 3, (r) => {
    requests.push(r);
    return [0, 0, 1, 1];
  });
  expect(requests).toContain(ref);
  for (let i = 0; i < mesh.positions.length; i += 9)
    if ([1, 4, 7].every((j) => mesh.positions[i + j] === 4))
      expect(mesh.colors.slice(i, i + 9)).toEqual(Array(9).fill(1));
});
