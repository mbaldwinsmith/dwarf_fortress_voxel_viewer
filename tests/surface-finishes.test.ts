import { it, expect, vi } from "vitest";
import type { Chunk, SpriteRef, Tile } from "../src/shared/model.js";
import { textureTerrain } from "../src/bridge/terrain-art.js";
import { applyEngravings, parseEngravings } from "../src/bridge/engravings.js";
import { maskEnclosedWalls } from "../src/bridge/wall-visibility.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { type } from "../src/bridge/protocol.js";
import { buildMesh } from "../src/viewer/mesh.js";
import { terrainPalette, terrainTone } from "../src/viewer/terrain-palette.js";
const ref: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 32,
  pageHeight: 32,
};
const empty = (): Chunk => ({
  x: 0,
  y: 0,
  z: 3,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
const msg = (c: Chunk) => ({
  type: "chunks",
  session: "s",
  sequence: 1,
  pollMs: 200,
  chunks: [c],
});
function decorate(tile: Tile, id = "INORGANIC:GRANITE", item = "BOULDER") {
  const c = empty();
  c.tiles[17] = tile;
  const refs = new Map<string, SpriteRef>(),
    get = (k: string) => {
      if (/^(SMOOTHED|ENGRAVED|ROCK_BLOCKS|WOODEN|METAL_BARS).*_[1-4]$/.test(k))
        return undefined;
      if (!refs.has(k)) refs.set(k, { ...ref });
      return refs.get(k);
    };
  textureTerrain(c, { get }, Array(256).fill({ matType: 0, matIndex: 0 }), {
    definitions: new Map([["0,0", { id, name: id, color: [0, 0, 0] }]]),
    metals: new Set(["INORGANIC:IRON"]),
    gems: new Set(["INORGANIC:RUBY"]),
    ores: new Set(["INORGANIC:HEMATITE"]),
    palettes: new Map([[id, { asset: "b".repeat(24), row: 12, sourceRow: 0 }]]),
    constructionItems: Array(256).fill({ matType: 1, matIndex: -1 }),
    itemDefinitions: new Map([["1,-1", item]]),
  });
  return { c, refs, tile: c.tiles[17] };
}
it.each([
  ["INORGANIC:GRANITE", "BLOCKS", "FLOOR_STONE_BLOCK", "ROCK_BLOCKS_WALL_N"],
  ["PLANT:OAK:WOOD", "WOOD", "WOOD_FLOOR", "WOODEN_WALL_N"],
  ["INORGANIC:IRON", "BAR", "METAL_FLOOR", "METAL_BARS_WALL_N"],
  ["GLASS_GREEN", "BLOCKS", "GLASS_GREEN_FLOOR", null],
  ["GLASS_CLEAR", "BLOCKS", "GLASS_CLEAR_FLOOR", null],
  ["GLASS_CRYSTAL", "BLOCKS", "GLASS_CRYSTAL_FLOOR", null],
])(
  "routes actual construction material %s and component %s",
  (id, item, floor, rim) => {
    const { tile, refs } = decorate(
      { shape: "wall", material: 7, name: "Wall", wallMask: 1 },
      id!,
      item!,
    );
    expect(tile.surfaces?.side).toBe(refs.get(floor!));
    if (rim) expect(tile.wallRim).toContain(refs.get(rim));
    else {
      expect(tile.wallCap).toBe(refs.get(floor!));
      expect(tile.wallRim).toBeUndefined();
    }
    expect(() =>
      parseServerMessage(msg({ ...empty(), tiles: Array(256).fill(tile) })),
    ).not.toThrow();
  },
);
it.each(["INORGANIC:MICROCLINE", "INORGANIC:HEMATITE", "INORGANIC:RUBY"])(
  "gives smoothed mineral %s its finished rim instead of rough vein art",
  (id) => {
    const { tile, refs } = decorate(
      {
        shape: "wall",
        material: 5,
        name: "Smooth mineral",
        smooth: true,
        wallMask: 1,
      },
      id,
    );
    expect(tile.wallRim).toEqual([refs.get("SMOOTHED_STONE_WALL_N")]);
    expect(tile.surfaces?.sideTint).toEqual([255, 255, 255]);
  },
);
it("uses smoothed ice art, a material-derived ice carving tone, and a continuous host rim for rough gems", () => {
  const ice = decorate(
    {
      shape: "wall",
      material: 6,
      name: "Ice",
      smooth: true,
      wallMask: 1,
      engraving: 1,
    },
    "WATER",
  );
  expect(ice.tile.wallRim).toContain(ice.refs.get("SMOOTHED_ICE_WALL_N"));
  expect(ice.tile.surfaces?.engravingTone).toBe(
    ice.refs.get("SMOOTH_ICE_FLOOR"),
  );
  expect(ice.tile.surfaces?.engravingPalette).toBeUndefined();
  const gem = decorate(
    { shape: "wall", material: 5, name: "Ruby", wallMask: 1, variant: 0 },
    "INORGANIC:RUBY",
  );
  expect(gem.tile.wallRim).toEqual([
    gem.refs.get("STONE_WALL_N_1"),
    gem.refs.get("GEM_A_WALL_N_1"),
  ]);
});
it("does not multiply actual black material RGB over a recoloured rough wall", () => {
  const { tile } = decorate({
    shape: "wall",
    material: 2,
    name: "Obsidian",
    wallMask: 1,
  });
  expect(tile.color).toEqual([0, 0, 0]);
  expect(tile.surfaces?.sideTint).toEqual([255, 255, 255]);
  const c = empty();
  c.tiles[17] = tile;
  const mesh = buildMesh(c, new Map([["0,0,3", c]]), 3);
  expect(mesh.colors.slice(0, 18)).toEqual(Array(18).fill(1));
});
it("round-trips native construction item type field 18 without changing materials", () => {
  const t = type("RemoteFortressReader.MapBlock"),
    input = {
      mapX: 0,
      mapY: 0,
      mapZ: 3,
      materials: [{ matType: 0, matIndex: 7 }],
      constructionItems: [{ matType: 2, matIndex: -1 }],
    };
  expect(t.toObject(t.decode(t.encode(input).finish()))).toMatchObject(input);
});
it("validates bounded engraving snapshots, duplicates and numeric masks", () => {
  expect(
    parseEngravings("DEEPWATCH_ENGRAVINGS:[[0,1,3,256]]", 0, 0, 3, 4),
  ).toEqual([[0, 1, 3, 256]]);
  for (const value of [
    "{}",
    "[[16,1,3,1]]",
    "[[0,1,4,1]]",
    "[[0,1,3,512]]",
    "[[0,1,3,0]]",
    "[[0,1,3,1.5]]",
    "[[0,1,3,1],[0,1,3,2]]",
  ])
    expect(() =>
      parseEngravings("DEEPWATCH_ENGRAVINGS:" + value, 0, 0, 3, 4),
    ).toThrow();
  expect(() => parseEngravings("", 0, 0, 3, 4)).toThrow();
});
it("replaces engravings on refresh and excludes hidden, rough, sealed and wrong-shape records", () => {
  const c = empty();
  c.tiles[0] = { shape: "floor", material: 2, name: "Floor", smooth: true };
  c.tiles[1] = { shape: "unknown", material: 0, name: "Hidden" };
  c.tiles[2] = { shape: "floor", material: 2, name: "Rough" };
  c.tiles[3] = { shape: "wall", material: 7, name: "Constructed" };
  applyEngravings(
    [c],
    [
      [0, 0, 3, 511],
      [1, 0, 3, 511],
      [2, 0, 3, 511],
      [3, 0, 3, 511],
    ],
  );
  expect(c.tiles.map((t) => t.engraving).slice(0, 4)).toEqual([
    256,
    undefined,
    undefined,
    255,
  ]);
  applyEngravings([c], []);
  expect(c.tiles.every((t) => t.engraving === undefined)).toBe(true);
  c.tiles = Array.from({ length: 256 }, () => ({
    shape: "wall",
    material: 2,
    name: "Wall",
    smooth: true,
    engraving: 1,
  }));
  maskEnclosedWalls(c);
  expect(c.tiles.every((t) => t.engraving === undefined)).toBe(true);
});
it.each([
  [1, 2, 1 - 0.002],
  [2, 2, 2 + 0.002],
  [4, 0, 1 - 0.002],
  [8, 0, 2 + 0.002],
])(
  "puts carving bit %s only on its matching exposed face",
  (mask, axis, coordinate) => {
    const c = empty();
    c.tiles[17] = {
      shape: "wall",
      material: 2,
      name: "Wall",
      smooth: true,
      engraving: mask,
      surfaces: {
        top: ref,
        side: ref,
        engraving: { ...ref, asset: "b".repeat(24) },
      },
    };
    const mesh = buildMesh(c, new Map([["0,0,3", c]]), 3, (r) =>
      r?.asset === "b".repeat(24) ? [0.2, 0.2, 0.8, 0.8] : [0, 0, 1, 1],
    );
    const panels = [];
    for (let i = 0; i < mesh.positions.length / 3; i += 6)
      if (mesh.uvs[i * 2] === 0.2)
        panels.push(mesh.positions.slice(i * 3, i * 3 + 18));
    expect(panels).toHaveLength(1);
    for (let i = axis; i < 18; i += 3)
      expect(panels[0][i]).toBeCloseTo(coordinate);
    // Adding a solid neighbour culls that carving as well as its host wall face.
    const index = mask === 1 ? 1 : mask === 2 ? 33 : mask === 4 ? 16 : 18;
    c.tiles[index] = { shape: "wall", material: 2, name: "Neighbour" };
    const calls: SpriteRef[] = [];
    buildMesh(c, new Map([["0,0,3", c]]), 3, (r) => {
      if (r) calls.push(r);
      return [0, 0, 1, 1];
    });
    expect(calls.some((r) => r.asset === "b".repeat(24))).toBe(false);
  },
);
it("rejects engraving metadata on hidden/rough terrain and malformed palettes", () => {
  for (const tile of [
    { shape: "unknown", material: 0, name: "Hidden", engraving: 1 },
    { shape: "floor", material: 2, name: "Rough", engraving: 256 },
    { shape: "wall", material: 2, name: "Wall", smooth: true, engraving: 256 },
  ]) {
    const c = empty();
    c.tiles[0] = tile as Tile;
    expect(() => parseServerMessage(msg(c))).toThrow();
  }
  const { c, tile } = decorate({
    shape: "floor",
    material: 2,
    name: "Floor",
    smooth: true,
    engraving: 256,
  });
  expect(() => parseServerMessage(msg(c))).not.toThrow();
  tile.surfaces!.palette!.row = -1;
  expect(() => parseServerMessage(msg(c))).toThrow();
});
it("maps legacy neutral tones through native palette shading while preserving alpha and coloured art", () => {
  const source = new Uint8ClampedArray(18 * 4),
    target = new Uint8ClampedArray(18 * 4);
  for (let i = 0; i < 18; i++) {
    source.set([i * 14, i * 14, i * 14, 255], i * 4);
    target.set([i * 14, 0, 0, 255], i * 4);
  }
  const px = new Uint8ClampedArray([
    150, 151, 152, 128, 0, 255, 100, 255, 0, 0, 0, 0,
  ]);
  terrainPalette(px, source, target);
  expect(px[0]).toBeGreaterThan(145);
  expect([...px.slice(1, 4)]).toEqual([0, 0, 128]);
  expect([...px.slice(4)]).toEqual([0, 255, 100, 255, 0, 0, 0, 0]);
});
it("keeps carvings inside the native material tone range and preserves transparency", () => {
  const px = new Uint8ClampedArray([
      47, 48, 56, 0, 70, 70, 70, 255, 240, 240, 240, 255,
    ]),
    tone = new Uint8ClampedArray([
      0, 40, 80, 255, 40, 120, 200, 255, 80, 200, 255, 255,
    ]);
  terrainTone(px, tone);
  expect(px[3]).toBe(0);
  expect(px[4]).toBeLessThan(px[8]);
  expect(px[6]).toBeGreaterThan(px[4]);
  expect(px[10]).toBeLessThanOrEqual(255);
});
it("does not lose carved relief when a native material is mostly one flat shade", () => {
  const material = new Uint8ClampedArray(1024 * 4);
  for (let i = 0; i < 1024; i++) material.set([20, 80, 40, 255], i * 4);
  material.set([100, 180, 120, 255], 0);
  material.set([5, 35, 15, 255], 4);
  const engraving = new Uint8ClampedArray([
    60, 62, 70, 255, 165, 166, 165, 255,
  ]);
  terrainTone(engraving, material);
  expect(engraving[5] - engraving[1]).toBeGreaterThan(100);
});
it("recognizes constructed ice from the actual WATER material, including block components", () => {
  for (const shape of ["wall", "floor"] as const)
    for (const engraving of [undefined, shape === "wall" ? 1 : 256]) {
      const { tile, refs } = decorate(
        {
          shape,
          material: 7,
          name: "Ice construction",
          ...(shape === "wall" ? { wallMask: 1 } : {}),
          ...(engraving ? { engraving } : {}),
        },
        "WATER",
        "BLOCKS",
      );
      expect(tile.surfaces?.side).toBe(refs.get("SMOOTH_ICE_FLOOR"));
      expect(tile.surfaces?.palette).toBeUndefined();
      if (shape === "wall")
        expect(tile.wallRim).toContain(refs.get("SMOOTHED_ICE_WALL_N"));
    }
});
