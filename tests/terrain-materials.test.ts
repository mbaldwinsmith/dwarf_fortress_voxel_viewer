import { it, expect } from "vitest";
import { textureTerrain, terrainMaterials } from "../src/bridge/terrain-art.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import { linearMaterialColor, buildMesh } from "../src/viewer/mesh.js";
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
const definitions = terrainMaterials([
  {
    matPair: { matType: 0, matIndex: 1 },
    id: "INORGANIC:MICROCLINE",
    name: "microcline",
    stateColor: { red: 0, green: 255, blue: 255 },
  },
  {
    matPair: { matType: 0, matIndex: 2 },
    id: "INORGANIC:SILTSTONE",
    name: "siltstone",
    stateColor: { red: 194, green: 178, blue: 128 },
  },
  {
    matPair: { matType: 419, matIndex: 5 },
    id: "PLANT:OAK:WOOD",
    name: "oak",
    stateColor: { red: 150, green: 75, blue: 0 },
  },
]);
it("uses actual static stone and construction material RGB rather than broad terrain class or underlying geology", () => {
  const c = chunk();
  c.tiles[0] = { shape: "wall", material: 2, name: "Stone" };
  c.tiles[1] = { shape: "floor", material: 7, name: "Construction" };
  const mats = [
      { matType: 0, matIndex: 1 },
      { matType: 419, matIndex: 5 },
    ],
    base = [
      { matType: 0, matIndex: 2 },
      { matType: 0, matIndex: 2 },
    ];
  textureTerrain(c, { get: () => ref }, mats, {
    definitions,
    baseMaterials: base,
  });
  expect(c.tiles[0].color).toEqual([0, 255, 255]);
  expect(c.tiles[1].color).toEqual([150, 75, 0]);
  expect(c.tiles[1].materialName).toBe("oak");
});
it("reads native cavern grass tokens and uses species art without double tinting its authored colour", () => {
  expect(
    sceneryMappings(
      "[PLANT_GRAPHICS:FLOOR FUNGI][GRASS_1:CAVERN_GRASS:0:0][GRASS_2:CAVERN_GRASS:1:0]",
    ).map((m) => m.key),
  ).toEqual(["PLANT:FLOOR FUNGI:GRASS_1", "PLANT:FLOOR FUNGI:GRASS_2"]);
  const c = chunk();
  c.tiles[0] = { shape: "floor", material: 9, name: "dark grass" };
  const requests: string[] = [];
  textureTerrain(
    c,
    {
      get: (key) => {
        requests.push(key);
        return ref;
      },
    },
    [{ matType: 419, matIndex: 127 }],
    {
      definitions,
      plants: new Map([[127, { id: "FLOOR FUNGI", name: "floor fungus" }]]),
      layerMaterials: [{ matType: 0, matIndex: 2 }],
    },
  );
  expect(requests.some((k) => /^PLANT:FLOOR FUNGI:GRASS_[1-4]$/.test(k))).toBe(
    true,
  );
  expect(c.tiles[0].surfaces?.topTint).toEqual([255, 255, 255]);
  expect(c.tiles[0].color).toEqual([194, 178, 128]);
  expect(requests).toContain("DIRT_FLOOR_5");
});
it("converts actual RGB to linear vertex colours while retaining coloured grass on ramp tops", () => {
  expect(linearMaterialColor([255, 0, 128])).toEqual([
    1,
    0,
    expect.closeTo(0.21586, 4),
  ]);
  const c = chunk();
  c.tiles[0] = {
    shape: "ramp",
    material: 9,
    name: "grass ramp",
    color: [100, 100, 100],
    surfaces: {
      top: ref,
      side: { ...ref, x: 32, pageWidth: 64 },
      topTint: [255, 255, 255],
    },
  };
  const requests: (SpriteRef | undefined)[] = [];
  const mesh = buildMesh(c, new Map([["0,0,3", c]]), 3, (r) => {
    requests.push(r);
    return [0, 0, 1, 1];
  });
  expect(requests).toContain(ref);
  expect(mesh.colors).toContain(1);
  expect(mesh.colors.some((v) => v > 0 && v < 1)).toBe(true);
});
it("does not invent missing colours and strips material metadata from unrevealed tiles", () => {
  const malformed = terrainMaterials([
    {
      matPair: { matType: 0, matIndex: 7 },
      id: "BAD",
      stateColor: { red: 256, green: 1, blue: 1 },
    },
  ]);
  expect(malformed.get("0,7")?.color).toBeUndefined();
  const c = chunk();
  c.tiles[0] = {
    shape: "unknown",
    material: 0,
    name: "Undiscovered",
    color: [1, 2, 3],
    materialName: "secret",
  };
  textureTerrain(c, { get: () => ref }, [{ matType: 0, matIndex: 1 }], {
    definitions,
  });
  expect(c.tiles[0].color).toBeUndefined();
  expect(c.tiles[0].materialName).toBeUndefined();
  c.tiles[1] = { shape: "floor", material: 2, name: "Stone" };
  textureTerrain(c, { get: () => ref }, [], { definitions });
  expect(c.tiles[1].color).toBeUndefined();
});
it("validates material and surface RGB on the wire and rejects hidden colour metadata", () => {
  const c = chunk();
  c.tiles[0] = {
    shape: "floor",
    material: 2,
    name: "Floor",
    color: [0, 255, 255],
    materialName: "microcline",
  };
  const msg = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  expect(() => parseServerMessage(msg())).not.toThrow();
  c.tiles[0].color = [256, 0, 0];
  expect(() => parseServerMessage(msg())).toThrow();
  c.tiles[0].color = [0, 0, 0];
  c.tiles[0].shape = "unknown";
  expect(() => parseServerMessage(msg())).toThrow();
});
