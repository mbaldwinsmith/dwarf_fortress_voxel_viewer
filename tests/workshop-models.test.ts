import { it, expect } from "vitest";
import {
  WORKSHOP_MODELS,
  type SceneryObject,
  type SpriteRef,
  type Chunk,
  type WorkshopModel,
} from "../src/shared/model.js";
import { workshopFaces } from "../src/viewer/workshop-models.js";
import { buildingObjects } from "../src/bridge/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 768,
  pageHeight: 3584,
};
const size = (type: string) =>
  /KENNEL|SIEGE|TRADE_DEPOT/.test(type)
    ? 5
    : /QUERN|MILLSTONE|SCREW_PRESS/.test(type)
      ? 1
      : 3;
const object = (type: WorkshopModel, col = 0, row = 0): SceneryObject => ({
  id: `b:1:${col}:${row}`,
  x: 14 + col,
  y: 2 + row,
  z: 4,
  name: type,
  kind: "ground",
  sprite,
  workshop: {
    type,
    col,
    row,
    width: size(type),
    depth: size(type),
    wood: sprite,
    stone: sprite,
    metal: sprite,
  },
});
const chunk = (x = 0): Chunk => ({
  x,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Floor",
  })),
});
it("gives every declared workshop a bounded 3D layout, including all furnace variants", () => {
  for (const type of WORKSHOP_MODELS) {
    let total = 0,
      raised = 0,
      valid = true;
    for (let row = 0; row < size(type); row++)
      for (let col = 0; col < size(type); col++) {
        const o = object(type, col, row),
          faces = workshopFaces(o, 4.12);
        total += faces.length;
        for (const f of faces) {
          valid &&= f.positions.length === 12 && (!f.uvs || f.uvs.length === 8);
          for (let i = 0; i < f.positions.length; i += 3) {
            const [x, y, z] = f.positions.slice(i, i + 3);
            valid &&=
              Number.isFinite(x + y + z) &&
              x >= o.x - 1e-8 &&
              x <= o.x + 1 + 1e-8 &&
              z >= o.y - 1e-8 &&
              z <= o.y + 1 + 1e-8 &&
              y >= 4.12 - 1e-8 &&
              y < 5;
            if (y > 4.3) raised++;
          }
        }
      }
    expect(total, type).toBeGreaterThan(30);
    expect(valid, type).toBe(true);
    expect(raised, type).toBeGreaterThan(20);
  }
});
it("clips a workshop crossing chunks without sending geometry for hidden footprint cells", () => {
  const b = {
    index: 1,
    posXMin: 14,
    posXMax: 16,
    posYMin: 1,
    posYMax: 3,
    posZMax: 4,
    buildingType: { buildingType: 13, buildingSubtype: 0, buildingCustom: -1 },
  };
  const defs = new Map([["13,0,-1", "Workshop/Carpenters"]]),
    graphics = { get: () => sprite },
    c = chunk(),
    next = chunk(16);
  c.tiles[30].shape = "unknown";
  c.objects = buildingObjects(c, [b], defs, graphics);
  next.objects = buildingObjects(next, [b], defs, graphics);
  expect(c.objects).toHaveLength(5);
  expect(next.objects).toHaveLength(3);
  expect(c.objects.some((o) => o.x === 14 && o.y === 1)).toBe(false);
  expect(next.objects.every((o) => o.workshop?.col === 2)).toBe(true);
  for (const block of [c, next]) {
    expect(() =>
      parseServerMessage({
        type: "chunks",
        session: "s",
        sequence: 1,
        pollMs: 200,
        chunks: [block],
      }),
    ).not.toThrow();
    for (const o of block.objects!)
      expect(
        workshopFaces(o, 4.12).every((f) =>
          f.positions
            .filter((_, i) => i % 3 === 0)
            .every((x) => x >= block.x - 1e-8 && x <= block.x + 16 + 1e-8),
        ),
      ).toBe(true);
  }
});
it("uses native one-tile mill art and leaves unknown workshop definitions on the fallback path", () => {
  const b = {
    index: 1,
    posXMin: 1,
    posXMax: 1,
    posYMin: 1,
    posYMax: 1,
    posZMax: 4,
    buildingType: { buildingType: 13, buildingSubtype: 1, buildingCustom: -1 },
  };
  const objects = buildingObjects(
    chunk(),
    [b],
    new Map([["13,1,-1", "Workshop/Quern"]]),
    { get: (key) => (key === "WORKSHOP_QUERN:1:1" ? sprite : undefined) },
  );
  expect(objects[0]).toMatchObject({
    sprite,
    workshop: { type: "WORKSHOP_QUERN", width: 1, depth: 1 },
  });
  expect(
    buildingObjects(
      chunk(),
      [b],
      new Map([["13,1,-1", "Workshop/UNSUPPORTED_MOD"]]),
      { get: () => sprite },
    )[0].workshop,
  ).toBeUndefined();
});
it("reuses local layouts without leaking world positions, z-levels or mutable output", () => {
  const o = object("WORKSHOP_LOOM", 1, 0),
    a = workshopFaces(o, 4.12),
    copy = structuredClone(a);
  const shifted = workshopFaces({ ...o, x: o.x + 16, y: o.y + 16, z: 5 }, 5.12);
  expect(shifted.length).toBe(a.length);
  for (let i = 0; i < a.length; i++)
    for (let k = 0; k < 12; k++)
      expect(shifted[i].positions[k] - a[i].positions[k]).toBeCloseTo(
        k % 3 === 1 ? 1 : 16,
      );
  a[0].positions[0] = -999;
  expect(workshopFaces(o, 4.12)).toEqual(copy);
});
it("rejects invalid recipe names, footprint offsets and native image references", () => {
  const c = chunk(16),
    o = object("WORKSHOP_LOOM", 2, 0);
  c.objects = [o];
  const msg = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  for (const delta of [
    { type: "UNKNOWN" },
    { col: 3 },
    { width: 6 },
    { row: -1 },
    { wood: { ...sprite, asset: "../secret" } },
  ]) {
    c.objects = [
      { ...o, workshop: { ...o.workshop!, ...delta } } as SceneryObject,
    ];
    expect(() => parseServerMessage(msg())).toThrow();
  }
});
