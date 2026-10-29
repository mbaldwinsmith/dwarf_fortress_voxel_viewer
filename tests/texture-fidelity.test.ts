import { it, expect } from "vitest";
import { textureTerrain, terrainMaterials } from "../src/bridge/terrain-art.js";
import { buildingObjects, SceneryReader } from "../src/bridge/scenery.js";
import {
  wallCapColor,
  linearMaterialColor,
  buildMesh,
} from "../src/viewer/mesh.js";
import { parseServerMessage } from "../src/shared/validation.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
import type { Rpc } from "../src/bridge/rpc.js";
import type { SceneryGraphics } from "../src/bridge/scenery-graphics.js";
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
    shape: "floor",
    material: 2,
    name: "Stone floor",
  })),
});
it("preserves authored floor RGB and native charcoal while retaining actual material labels", () => {
  const c = chunk();
  textureTerrain(
    c,
    { get: () => ref },
    Array(256).fill({ matType: 0, matIndex: 1 }),
    {
      definitions: terrainMaterials([
        {
          matPair: { matType: 0, matIndex: 1 },
          id: "INORGANIC:SCHIST",
          name: "schist",
          stateColor: { red: 152, green: 105, blue: 96 },
        },
      ]),
    },
  );
  expect(c.tiles[0].surfaces?.topTint).toEqual([255, 255, 255]);
  expect(c.tiles[0].materialName).toBe("schist");
  expect(wallCapColor).toEqual(linearMaterialColor([49, 44, 52]));
});
it("selects native grass variants from tile data rather than a different coordinate hash", () => {
  const c = chunk();
  c.tiles[0] = { shape: "floor", material: 9, name: "dark grass", variant: 2 };
  const requested: string[] = [];
  textureTerrain(
    c,
    {
      get: (key) => {
        requested.push(key);
        return ref;
      },
    },
    [{ matType: 419, matIndex: 127 }],
    { plants: new Map([[127, { id: "FLOOR FUNGI", name: "floor fungus" }]]) },
  );
  expect(requested).toContain("PLANT:FLOOR FUNGI:GRASS_3");
});
it("distinguishes ordinary vein stone, metal ore and gems in wall border art", () => {
  const c = chunk(),
    requested: string[] = [];
  for (let i = 0; i < 3; i++)
    c.tiles[i] = {
      shape: "wall",
      material: 5,
      name: "mineral wall",
      wallMask: 1,
    };
  const definitions = terrainMaterials(
    ["MICA", "SPHALERITE", "PRASE"].map((id, i) => ({
      matPair: { matType: 0, matIndex: i },
      id: `INORGANIC:${id}`,
      stateColor: { red: 102, green: 0, blue: 102 },
    })),
  );
  textureTerrain(
    c,
    {
      get: (key) => {
        requested.push(key);
        return ref;
      },
    },
    [0, 1, 2].map((matIndex) => ({ matType: 0, matIndex })),
    {
      definitions,
      ores: new Set(["INORGANIC:SPHALERITE"]),
      gems: new Set(["INORGANIC:PRASE"]),
    },
  );
  expect(requested.some((k) => k.startsWith("STONE_WALL_N_"))).toBe(true);
  expect(requested.some((k) => k.startsWith("ORE_VEIN_WALL_N"))).toBe(true);
  expect(requested.some((k) => k.startsWith("GEM_A_WALL_N"))).toBe(true);
  expect(c.tiles[1].wallRimTint).toEqual([224, 204, 224]);
});
it("layers native bed sheets and pillows stably and validates their bounded tint controls", () => {
  const c = chunk(),
    b = {
      index: 1,
      posXMin: 1,
      posXMax: 1,
      posYMin: 1,
      posYMax: 1,
      posZMax: 3,
      buildingType: {
        buildingType: 1,
        buildingSubtype: -1,
        buildingCustom: -1,
      },
      material: { matType: 420, matIndex: 2 },
      items: [{ mode: 2, item: { id: 1889 } }],
    };
  const defs = new Map([["1,-1,-1", "Bed"]]);
  const a = buildingObjects(c, [b], defs, { get: () => ref });
  expect(a[0].details).toHaveLength(2);
  expect(buildingObjects(c, [b], defs, { get: () => ref })[0].details).toEqual(
    a[0].details,
  );
  c.objects = a;
  const msg = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  expect(() => parseServerMessage(msg())).not.toThrow();
  c.objects[0].details![0].brightness = 9;
  expect(() => parseServerMessage(msg())).toThrow();
});
it("uses native stair texture planes while retaining geometry when local art is absent", async () => {
  const c = chunk();
  c.tiles[0].shape = "stairs";
  c.tiles[0].name = "up/down stair";
  const rpc = { call: async () => ({}) } as unknown as Rpc;
  const art = {
    get: (k: string) => (k === "STONE_STAIR_UPDOWN" ? ref : undefined),
    gemIds: new Set(),
    oreIds: new Set(),
  } as unknown as SceneryGraphics;
  const reader = new SceneryReader(rpc, art, {
    x: 0,
    y: 0,
    z: 0,
    width: 16,
    depth: 16,
    height: 10,
  });
  await reader.initialize();
  await reader.decorate(c);
  expect(c.objects?.some((o) => o.id === "s:0:0:3" && o.sprite === ref)).toBe(
    true,
  );
  const all = new Map([["0,0,3", c]]);
  expect(
    Math.max(...buildMesh(c, all, 3).positions.filter((_, i) => i % 3 === 1)),
  ).toBeCloseTo(3.12);
  c.objects = [];
  expect(
    Math.max(...buildMesh(c, all, 3).positions.filter((_, i) => i % 3 === 1)),
  ).toBeGreaterThan(3.8);
});
