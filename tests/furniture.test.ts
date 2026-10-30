import { it, expect, vi } from "vitest";
import * as THREE from "three";
import { furnitureFaces } from "../src/viewer/furniture.js";
import { ScenerySprites } from "../src/viewer/scenery.js";
import { buildingObjects } from "../src/bridge/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import type { Chunk, SceneryObject, SpriteRef } from "../src/shared/model.js";
import { FURNITURE_TYPES } from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 32,
  width: 32,
  height: 32,
  pageWidth: 352,
  pageHeight: 128,
};
const palette = { asset: "b".repeat(24), row: 32, sourceRow: 0 };
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
const object = (
  type: NonNullable<SceneryObject["furniture"]>["type"],
): SceneryObject => ({
  id: "b:1",
  x: 2,
  y: 3,
  z: 4,
  name: type,
  kind: "ground",
  sprite,
  palette,
  furniture: { type },
});
it("grounds complete furniture volumes within a tile and below the next ceiling", () => {
  for (const type of FURNITURE_TYPES) {
    const o = object(type),
      faces = furnitureFaces(o, 4.12),
      p = faces.flatMap((f) => f.positions);
    expect(Math.min(...p.filter((_, i) => i % 3 === 1))).toBeCloseTo(4.12);
    expect(Math.max(...p.filter((_, i) => i % 3 === 1))).toBeLessThan(5);
    expect(Math.min(...p.filter((_, i) => i % 3 === 0))).toBeGreaterThan(2);
    expect(Math.max(...p.filter((_, i) => i % 3 === 0))).toBeLessThan(3);
    expect(Math.min(...p.filter((_, i) => i % 3 === 2))).toBeGreaterThan(3);
    expect(Math.max(...p.filter((_, i) => i % 3 === 2))).toBeLessThan(4);
    expect(new Set(p.filter((_, i) => i % 3 === 1)).size).toBeGreaterThan(2);
    for (const f of faces.filter((f) => f.sprite)) {
      expect(f.palette).toEqual(palette);
      expect(f.sprite!.x).toBeGreaterThanOrEqual(sprite.x);
      expect(f.sprite!.x + f.sprite!.width).toBeLessThanOrEqual(
        sprite.x + sprite.width,
      );
      expect(f.sprite!.y + f.sprite!.height).toBeLessThanOrEqual(
        sprite.y + sprite.height,
      );
    }
  }
  const bed = furnitureFaces(object("bed"), 4.12);
  expect(bed.some((f) => !f.sprite && f.tint)).toBe(true);
});
it("batches multiple furnishings without the old floor quads and disposes replacements", () => {
  const load = vi
    .spyOn(THREE.TextureLoader.prototype, "load")
    .mockReturnValue(new THREE.Texture());
  const view = new ScenerySprites(),
    c = chunk();
  try {
    c.objects = [object("table"), { ...object("chair"), id: "b:2", x: 4 }];
    const all = new Map([["0,0,4", c]]);
    view.update([c], all);
    const meshes = view.group.children[0].children as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    const geom = meshes[0].geometry,
      dispose = vi.spyOn(geom, "dispose");
    expect(geom.getAttribute("position").count).toBe(
      (furnitureFaces(c.objects[0], 4.12).length +
        furnitureFaces(c.objects[1], 4.12).length) *
        4,
    );
    view.frame(new THREE.PerspectiveCamera(), 4);
    expect(view.visibleCount).toBe(2);
    view.frame(new THREE.PerspectiveCamera(), 3);
    expect(view.visibleCount).toBe(0);
    c.objects = [];
    view.update([c], all);
    expect(dispose).toHaveBeenCalledOnce();
    expect(view.group.children[0].children).toHaveLength(0);
  } finally {
    view.dispose();
    load.mockRestore();
  }
});
it("transmits explicit furniture types only for installed visible furniture", () => {
  const c = chunk();
  const b = {
    index: 1,
    posXMin: 2,
    posXMax: 2,
    posYMin: 3,
    posYMax: 3,
    posZMax: 4,
    buildingType: { buildingType: 1, buildingSubtype: -1, buildingCustom: -1 },
    material: { matType: 0, matIndex: 7 },
  };
  for (const type of [
    "Table",
    "Chair",
    "Bed",
    "Cabinet",
    "Coffin",
    "Bookcase",
    "Box",
  ]) {
    c.objects = buildingObjects(c, [b], new Map([["1,-1,-1", type]]), {
      get: () => sprite,
    });
    expect(c.objects[0].furniture).toEqual({
      type: type === "Box" ? "chest" : type.toLowerCase(),
      heavy: true,
    });
    const message = () => ({
      type: "chunks",
      session: "s",
      sequence: 1,
      pollMs: 200,
      chunks: [c],
    });
    expect(() => parseServerMessage(message())).not.toThrow();
    c.objects[0].furniture = { type: "invalid" as "bed" };
    expect(() => parseServerMessage(message())).toThrow();
  }
  c.tiles[50].shape = "unknown";
  expect(
    buildingObjects(c, [b], new Map([["1,-1,-1", "Table"]]), {
      get: () => sprite,
    }),
  ).toEqual([]);
});
it("closes the tapered coffin and keeps lid UVs continuous across the shoulders", () => {
  const faces = furnitureFaces(object("coffin"), 4.12),
    edges = new Map<string, number>();
  for (const f of faces) {
    const points = Array.from({ length: 4 }, (_, i) =>
      f.positions
        .slice(i * 3, i * 3 + 3)
        .map((n) => n.toFixed(6))
        .join(","),
    );
    for (let i = 0; i < 4; i++) {
      const key = [points[i], points[(i + 1) % 4]].sort().join("/");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
  const shared = new Map<string, string>();
  for (const f of faces.filter((f) => f.uvs))
    for (let i = 0; i < 4; i++) {
      const point = f.positions.slice(i * 3, i * 3 + 3).join(","),
        uv = f.uvs!.slice(i * 2, i * 2 + 2).join(",");
      if (shared.has(point)) expect(uv).toBe(shared.get(point));
      else shared.set(point, uv);
    }
});
it("resolves bookcase material artwork within the current native tool definition", () => {
  expect(
    sceneryMappings(
      "[TOOL_GRAPHICS:BOOKS:0:1:ITEM_TOOL_BOOKCASE][TOOL_GRAPHICS_WOOD:ALL:BOOKS:0:0][TOOL_GRAPHICS_STONE:ALL:BOOKS:0:1][TOOL_GRAPHICS:TOOLS:2:3:ITEM_TOOL_HIVE][TOOL_GRAPHICS_WOOD:ALL:TOOLS:1:3]",
    ).map((e) => e.key),
  ).toEqual([
    "ITEM_TOOL_BOOKCASE",
    "ITEM_TOOL_BOOKCASE_WOOD",
    "ITEM_TOOL_BOOKCASE_STONE",
    "ITEM_TOOL_HIVE",
    "ITEM_TOOL_HIVE_WOOD",
  ]);
});
it("keeps smaller backless chairs and thrones symmetric in every facing direction", () => {
  for (const heavy of [false, true]) {
    const o = object("chair");
    if (heavy) o.furniture!.heavy = true;
    const p = furnitureFaces(o, 4.12).flatMap((f) => f.positions);
    const points = Array.from({ length: p.length / 3 }, (_, i) =>
      p.slice(i * 3, i * 3 + 3),
    );
    const key = ([x, y, z]: number[]) =>
      [x, y, z].map((v) => v.toFixed(6)).join(",");
    expect(
      new Set(
        points.map(([x, y, z]) =>
          key([o.x + 0.5 - (z - o.y - 0.5), y, o.y + 0.5 + (x - o.x - 0.5)]),
        ),
      ),
    ).toEqual(new Set(points.map(key)));
    expect(Math.max(...points.map((p) => p[1])) - 4.12).toBeCloseTo(0.35);
    expect(
      Math.max(...points.map((p) => p[0])) -
        Math.min(...points.map((p) => p[0])),
    ).toBeCloseTo(0.46);
  }
});
