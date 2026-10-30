import { it, expect } from "vitest";
import {
  parseYakBodies,
  parseCreatureBodies,
  parseGraphics,
  Graphics,
} from "../src/bridge/graphics.js";
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
it("extracts shared pack-animal body rules for both camels and other species, including large bodies", () => {
  const bodies = parseCreatureBodies(
    "[CREATURE_GRAPHICS:CAMEL_1_HUMP][LAYER_SET:DEFAULT][LAYER:BODY:SURFACE:0:88][CONDITION_NOT_CHILD][LAYER:CBODY:SURFACE:1:88][CONDITION_CHILD][LAYER:BAGS:BAGS:0:0][CONDITION_HAUL_COUNT_MIN:1]" +
      "[CREATURE_GRAPHICS:CAMEL_2_HUMP][LAYER_SET:DEFAULT][LAYER:BODY:SURFACE:0:124][CONDITION_NOT_CHILD][LAYER:CBODY:SURFACE:1:124][CONDITION_CHILD][LAYER_SET:CORPSE][LAYER:BODY:SURFACE:4:124][CONDITION_NOT_CHILD]" +
      "[CREATURE_CASTE_GRAPHICS:ELEPHANT:MALE][LAYER_SET:DEFAULT][LAYER:BODY:LARGE:LARGE_IMAGE:0:2:2:3][CONDITION_NOT_CHILD]" +
      "[CREATURE_GRAPHICS:DONKEY][LAYER_SET:DEFAULT][LAYER:BODY:DOMESTIC:0:8][CONDITION_NOT_CHILD]" +
      "[CREATURE_GRAPHICS:UNSAFE][LAYER_SET:DEFAULT][LAYER:BODY:WRONG:0:0][CONDITION_GHOST]",
  );
  expect(bodies.get("CAMEL_1_HUMP:ADULT")).toEqual({
    page: "SURFACE",
    x: 0,
    y: 88,
  });
  expect(bodies.get("CAMEL_2_HUMP:ADULT")).toEqual({
    page: "SURFACE",
    x: 0,
    y: 124,
  });
  expect(bodies.get("CAMEL_2_HUMP:CHILD")?.x).toBe(1);
  expect(bodies.get("ELEPHANT:MALE:ADULT")).toEqual({
    page: "LARGE",
    x: 0,
    y: 2,
    width: 3,
    height: 2,
  });
  expect(bodies.get("DONKEY:ADULT")?.page).toBe("DOMESTIC");
  expect(bodies.has("UNSAFE:ADULT")).toBe(false);
  expect([...bodies.keys()].some((k) => k.includes("BAGS"))).toBe(false);
  const g = new Graphics();
  g.refs.set("CAMEL_2_HUMP:ADULT", sprite);
  g.refs.set("CAMEL_2_HUMP:CHILD", { ...sprite, x: 32 });
  expect(g.resolve("CAMEL_2_HUMP", "MALE", 3)).toBe(sprite);
  expect(g.resolve("CAMEL_2_HUMP", "FEMALE", 0)?.x).toBe(32);
});
it("loads living large-image rectangles and rejects reversed or malformed bounds", () => {
  const parsed = parseGraphics(
    "[CREATURE_GRAPHICS:GIANT_CAMEL_1_HUMP][DEFAULT:GIANT:LARGE_IMAGE:0:232:2:233:AS_IS]" +
      "[CREATURE_GRAPHICS:DEER][DEFAULT:DEER:LARGE_IMAGE:12:0:14:1:AS_IS][CHILD:DEER:3:0:AS_IS:DEFAULT]" +
      "[CREATURE_GRAPHICS:BAD][DEFAULT:A:LARGE_IMAGE:3:2:0:1:AS_IS]" +
      "[CREATURE_GRAPHICS:NAN][DEFAULT:A:LARGE_IMAGE:x:2:4:3:AS_IS]",
  );
  expect(parsed.sprites.get("GIANT_CAMEL_1_HUMP")).toEqual({
    page: "GIANT",
    x: 0,
    y: 232,
    width: 3,
    height: 2,
  });
  expect(parsed.sprites.get("DEER")).toEqual({
    page: "DEER",
    x: 12,
    y: 0,
    width: 3,
    height: 2,
  });
  expect(parsed.sprites.get("DEER:CHILD")).toEqual({
    page: "DEER",
    x: 3,
    y: 0,
  });
  expect(parsed.sprites.has("BAD")).toBe(false);
  expect(parsed.sprites.has("NAN")).toBe(false);
});
it("uses a live animation-frame fallback without selecting corpse, portrait or list-icon art", () => {
  const parsed = parseGraphics(
    "[CREATURE_GRAPHICS:PERSON][ANIMATED:LIVE:1:0:AS_IS][CORPSE:DEAD:2:0:AS_IS][LIST_ICON:ICON:0:0][LAYER_SET:PORTRAIT][LAYER:MAIN:PORTRAIT:0:0]" +
      "[CREATURE_GRAPHICS:ANIMAL][ANIMATED:LIVE:2:0:AS_IS][DEFAULT:LIVE:0:0:AS_IS][ANIMATED:LIVE:3:0:AS_IS][CHILD:DEAD:4:0:AS_IS:CORPSE]" +
      "[CREATURE_GRAPHICS:VERMIN][VERMIN:SMALL:0:1][REMAINS:DEAD:3:1][STATUE_CREATURE_GRAPHICS:VERMIN][DEFAULT:STATUE:0:0:AS_IS]",
  );
  expect(parsed.sprites.get("PERSON")).toEqual({ page: "LIVE", x: 1, y: 0 });
  expect(parsed.sprites.get("ANIMAL")?.x).toBe(0);
  expect(parsed.sprites.has("ANIMAL:CHILD")).toBe(false);
  expect(parsed.sprites.get("VERMIN")).toEqual({ page: "SMALL", x: 0, y: 1 });
});
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
  expect(objects.map((o) => o.name)).toEqual(["fungiwood"]);
  expect(c.tiles[2].tree?.species).toBe("tower-cap");
  expect(c.tiles[2].tree?.bark).toEqual(sprite);
  expect(requested).toContain("PLANT:FUNGIWOOD:SAPLING");
  expect(requested).toContain("PLANT:TOWER_CAP:TREE_TRUNK_PILLAR");
  c.tiles[2] = { shape: "unknown", material: 0, name: "Undiscovered" };
  expect(plantObjects(c, [], defs, art, mats)).toHaveLength(1);
});
it("keeps actual 3D trunks rather than flattening them when legacy sprite art exists", () => {
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
  expect(Math.max(...replaced.positions.filter((_, i) => i % 3 === 1))).toBe(5);
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
