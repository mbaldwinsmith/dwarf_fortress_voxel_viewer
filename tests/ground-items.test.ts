import { it, expect } from "vitest";
import { groundItems } from "../src/bridge/ground-items.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import { buildingObjects } from "../src/bridge/scenery.js";
import { type } from "../src/bridge/protocol.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 32,
  pageHeight: 32,
};
const palette = { asset: "b".repeat(24), sourceRow: 0, row: 32 };
const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Floor",
  })),
});
const defs = new Map([
  ["4,-1", "BOULDER"],
  ["0,-1", "BAR"],
]);
const mats = new Map([
  [
    "0,7",
    {
      id: "INORGANIC:SCHIST",
      name: "schist",
      color: [80, 40, 30] as [number, number, number],
    },
  ],
]);
const art = {
  get: (key: string) =>
    [
      "ITEM_BOULDER",
      "ITEM_BARS",
      "ITEM_TABLE_STONE:1",
      "ITEM_CHAIR_STONE:1",
    ].includes(key)
      ? sprite
      : undefined,
  materialPalettes: new Map([["INORGANIC:SCHIST", palette]]),
};
const item = (id = 1, extra = {}) => ({
  id,
  pos: { x: 2, y: 3, z: 4 },
  flags1: 1,
  type: { matType: 4, matIndex: -1 },
  material: { matType: 0, matIndex: 7 },
  ...extra,
});
it("renders real ground items with native palettes, including forbidden and reserved items", () => {
  const c = chunk();
  const items = groundItems(
    c,
    [item(1, { flags1: 1 | 2 | (1 << 19) })],
    defs,
    mats,
    art,
  );
  expect(items).toMatchObject([
    { id: "i:1", name: "schist boulder", palette, sprite },
  ]);
  expect(items[0].tint).toBeUndefined();
});
it("excludes carried, contained, installed, hidden, deleted, encased and flying items", () => {
  for (const bit of [3, 4, 5, 10, 11, 17, 24])
    expect(
      groundItems(
        chunk(),
        [item(1, { flags1: 1 | (1 << bit) })],
        defs,
        mats,
        art,
      ),
    ).toEqual([]);
  for (const extra of [
    { flags1: 0 },
    { projectile: true },
    { pos: { x: 16, y: 3, z: 4 } },
    { pos: { x: 2, y: 3, z: 5 } },
    { id: -1 },
    { pos: { y: 3, z: 4 } },
  ])
    expect(groundItems(chunk(), [item(1, extra)], defs, mats, art)).toEqual([]);
  const c = chunk();
  c.tiles[50].shape = "unknown";
  expect(groundItems(c, [item()], defs, mats, art)).toEqual([]);
});
it("chooses a stable single graphic per tile and removes it when picked up", () => {
  expect(
    groundItems(chunk(), [item(9), item(2), item(2)], defs, mats, art).map(
      (o) => o.id,
    ),
  ).toEqual(["i:2"]);
  expect(groundItems(chunk(), [], defs, mats, art)).toEqual([]);
  expect(
    groundItems(chunk(), [item(2, { flags1: 8 })], defs, mats, art),
  ).toEqual([]);
});
it("keeps whole corpses and corpse pieces visible using native remains art", () => {
  for (const category of ["CORPSE", "CORPSEPIECE", "REMAINS"]) {
    const definitions = new Map([["4,-1", category]]);
    const graphics = {
      get: (key: string) => (key === "ITEM_REMAINS" ? sprite : undefined),
    };
    expect(
      groundItems(chunk(), [item()], definitions, mats, graphics),
    ).toMatchObject([{ id: "i:1", kind: "ground", sprite }]);
    expect(
      groundItems(
        chunk(),
        [item(1, { flags1: 1 | (1 << 4) })],
        definitions,
        mats,
        graphics,
      ),
    ).toEqual([]);
    const c = chunk();
    c.tiles[50].shape = "unknown";
    expect(groundItems(c, [item()], definitions, mats, graphics)).toEqual([]);
    expect(groundItems(chunk(), [], definitions, mats, graphics)).toEqual([]);
  }
});
it("decodes native ground item wire positions and material overrides", () => {
  const t = type("RemoteFortressReader.MapBlock");
  const b = t.toObject(
    t.decode(
      t
        .encode(t.create({ mapX: 0, mapY: 0, mapZ: 4, items: [item()] }))
        .finish(),
    ),
  );
  expect((b.items as any[])[0].pos).toEqual({ x: 2, y: 3, z: 4 });
  expect(
    sceneryMappings("[BOULDER_GRAPHICS:BOULDERS:0:13:INORGANIC:SCHIST]"),
  ).toEqual([
    { key: "BOULDER_GRAPHICS:INORGANIC:SCHIST", page: "BOULDERS", x: 0, y: 13 },
  ]);
});
it("uses the actual material palette for installed tables and thrones", () => {
  for (const [nativeId, kind] of [
    [2, "Chair"],
    [3, "Table"],
  ] as const) {
    const b = {
      index: 1,
      posXMin: 2,
      posXMax: 2,
      posYMin: 3,
      posYMax: 3,
      posZMax: 4,
      buildingType: {
        buildingType: nativeId,
        buildingSubtype: -1,
        buildingCustom: -1,
      },
      material: { matType: 0, matIndex: 7 },
    };
    expect(
      buildingObjects(
        chunk(),
        [b],
        new Map([[`${nativeId},-1,-1`, kind]]),
        art,
        mats,
      )[0],
    ).toMatchObject({ palette, sprite });
  }
});
