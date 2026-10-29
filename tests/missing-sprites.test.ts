import { it, expect } from "vitest";
import { parseYakBodies, Graphics } from "../src/bridge/graphics.js";
import { plantObjects } from "../src/bridge/scenery.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import { treeGraphicName, convertBlock } from "../src/bridge/adapter.js";
import { buildMesh } from "../src/viewer/mesh.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 64,
  pageHeight: 64,
};
it("reads default yak adult/calf body layers without choosing corpse or equipment art", () => {
  const bodies = parseYakBodies(
    "[CREATURE_GRAPHICS:YAK][LAYER_SET:DEFAULT][LAYER:BODY:ANIMALS:0:21][CONDITION_NOT_CHILD][LAYER:CBODY:ANIMALS:1:21][CONDITION_CHILD][LAYER:BAGS:BAGS:0:0][CONDITION_HAUL_COUNT_MIN:1][LAYER_SET:CORPSE][LAYER:BODY:ANIMALS:4:21][CONDITION_NOT_CHILD]",
  );
  expect(bodies.get("YAK:ADULT")).toEqual({ page: "ANIMALS", x: 0, y: 21 });
  expect(bodies.get("YAK:CHILD")?.x).toBe(1);
  const g = new Graphics();
  g.refs.set("YAK:ADULT", sprite);
  g.refs.set("YAK:CHILD", { ...sprite, x: 32 });
  expect(g.resolve("YAK", "MALE", 1)?.x).toBe(0);
  expect(g.resolve("YAK", "FEMALE", 0)?.x).toBe(32);
  expect(
    parseYakBodies(
      "[CREATURE_GRAPHICS:YAK][LAYER_SET:DEFAULT][LAYER:BODY:A:0:0][CONDITION_GHOST]",
    ),
  ).toHaveLength(0);
});
it("maps species-specific trunk and cap tokens separately from saplings", () => {
  expect(
    sceneryMappings(
      "[PLANT_GRAPHICS:TOWER_CAP][TREE_TILE:TREE_TRUNK_PILLAR:CAP:0:0][SAPLING:YOUNG:6:0]",
    ).map((e) => e.key),
  ).toEqual(["PLANT:TOWER_CAP:TREE_TRUNK_PILLAR", "PLANT:TOWER_CAP:SAPLING"]);
  expect(treeGraphicName("TreeTrunkPillar")).toBe("TREE_TRUNK_PILLAR");
  expect(treeGraphicName("TreeCapFloor1")).toBe("TREE_CAP_FLOOR_1");
  expect(treeGraphicName("TreeCapWallNSE")).toBe("TREE_CAP_WALL_N_S_E");
});
const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Stone",
  })),
});
it("finds young fungiwood and tower-cap trunks directly in visible tile materials, without plant position records", () => {
  const c = chunk();
  c.tiles[1] = { shape: "floor", material: 12, name: "sapling" };
  c.tiles[2] = {
    shape: "wall",
    material: 23,
    name: "trunk pillar",
    treeGraphic: "TREE_TRUNK_PILLAR",
  };
  const mats = Array.from({ length: 256 }, () => ({ matType: 0, matIndex: 0 }));
  mats[1] = { matType: 419, matIndex: 208 };
  mats[2] = { matType: 419, matIndex: 204 };
  const requested: string[] = [];
  const art = {
    get: (key: string) => {
      requested.push(key);
      return sprite;
    },
  };
  const defs = new Map([
    [208, { id: "FUNGIWOOD", name: "fungiwood" }],
    [204, { id: "TOWER_CAP", name: "tower-cap" }],
  ]);
  const objects = plantObjects(
    c,
    [{ posX: 1, posY: 0, posZ: 4, index: 208 }],
    defs,
    art,
    mats,
  );
  expect(objects.map((o) => o.name)).toEqual(["fungiwood", "tower-cap"]);
  expect(requested).toContain("PLANT:FUNGIWOOD:SAPLING");
  expect(requested).toContain("PLANT:TOWER_CAP:TREE_TRUNK_PILLAR");
  c.tiles[2] = { shape: "unknown", material: 0, name: "Undiscovered" };
  expect(plantObjects(c, [], defs, art, mats)).toHaveLength(1);
});
it("keeps tree voxels as a fallback and removes their occluding cube only when sprite art exists", () => {
  const c = chunk();
  c.tiles[2] = {
    shape: "wall",
    material: 23,
    name: "trunk pillar",
    treeGraphic: "TREE_TRUNK_PILLAR",
  };
  const all = new Map([["0,0,4", c]]);
  const original = buildMesh(c, all, 4);
  c.objects = [
    { id: "p", x: 2, y: 0, z: 4, name: "tower-cap", kind: "plant", sprite },
  ];
  const replaced = buildMesh(c, all, 4);
  expect(Math.max(...original.positions.filter((_, i) => i % 3 === 1))).toBe(5);
  expect(
    Math.max(...replaced.positions.filter((_, i) => i % 3 === 1)),
  ).toBeCloseTo(4.12);
  const raw = {
    mapX: 0,
    mapY: 0,
    mapZ: 4,
    tiles: Array(256).fill(1),
    hidden: Array(256).fill(true),
  };
  expect(
    convertBlock(
      raw,
      0,
      0,
      4,
      new Map([
        [
          1,
          {
            shape: 4,
            material: 23,
            name: "Tree",
            treeGraphic: "TREE_TRUNK_PILLAR",
          },
        ],
      ]),
    ).tiles[0],
  ).not.toHaveProperty("treeGraphic");
});
