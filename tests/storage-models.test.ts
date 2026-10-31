import { it, expect } from "vitest";
import * as THREE from "three";
import { furnitureFaces } from "../src/viewer/furniture.js";
import { groundItems } from "../src/bridge/ground-items.js";
import { buildingObjects } from "../src/bridge/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import type {
  Chunk,
  SceneryObject,
  FurnitureType,
  SpriteRef,
} from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 256,
  pageHeight: 448,
};
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
const model = (type: FurnitureType): SceneryObject => ({
  id: "i:1",
  x: 2,
  y: 3,
  z: 4,
  name: type,
  kind: "ground",
  sprite,
  furniture: { type },
});
it("leaves real openings down to the interior bottoms of containers", () => {
  for (const type of ["barrel", "bin", "bucket", "pot"] as const) {
    const faces = furnitureFaces(model(type), 4.12),
      positions = faces.flatMap((f) => [
        ...f.positions.slice(0, 9),
        ...f.positions.slice(0, 3),
        ...f.positions.slice(6, 12),
      ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      mesh = new THREE.Mesh(geometry, material);
    const hits = new THREE.Raycaster(
      new THREE.Vector3(2.5, 6, type === "bucket" ? 3.58 : 3.5),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(mesh);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(
      4.12 + { bucket: 0.04, bin: 0.045, barrel: 0.05, pot: 0.05 }[type],
      4,
    );
    geometry.dispose();
    material.dispose();
  }
});
it("renders moving ground containers with material art and removes picked-up or hidden ones", () => {
  const defs = new Map([
    ["17,-1", "BARREL"],
    ["32,-1", "BIN"],
    ["18,-1", "BUCKET"],
    ["86,12", "TOOL/ITEM_TOOL_LARGE_POT"],
  ]);
  const mats = new Map([
    [
      "0,1",
      {
        id: "INORGANIC:IRON",
        name: "iron",
        color: [100, 110, 120] as [number, number, number],
      },
    ],
  ]);
  const seen: string[] = [],
    art = {
      get: (key: string) => {
        seen.push(key);
        return /METAL|ITEM_TOOL_LARGE_POT$/.test(key) ? sprite : undefined;
      },
      metalIds: new Set(["INORGANIC:IRON"]),
    };
  for (const [wire, type] of [
    [17, "barrel"],
    [32, "bin"],
    [18, "bucket"],
    [86, "pot"],
  ] as const) {
    const c = chunk(),
      item = {
        id: 1,
        flags1: 1,
        pos: { x: 2, y: 3, z: 4 },
        type: { matType: wire, matIndex: wire === 86 ? 12 : -1 },
        material: { matType: 0, matIndex: 1 },
      };
    const objects = groundItems(c, [item], defs, mats, art);
    expect(objects[0].furniture).toMatchObject({
      type,
      color: [100, 110, 120],
    });
    c.objects = objects;
    expect(() =>
      parseServerMessage({
        type: "chunks",
        session: "s",
        sequence: 1,
        pollMs: 200,
        chunks: [c],
      }),
    ).not.toThrow();
    expect(
      groundItems(
        c,
        [{ ...item, pos: { x: 3, y: 3, z: 4 } }],
        defs,
        mats,
        art,
      )[0].x,
    ).toBe(3);
    expect(
      groundItems(c, [{ ...item, flags1: 1 | (1 << 3) }], defs, mats, art),
    ).toEqual([]);
    c.tiles[50].shape = "unknown";
    expect(groundItems(c, [item], defs, mats, art)).toEqual([]);
    expect(groundItems(c, [], defs, mats, art)).toEqual([]);
  }
  expect(seen).toContain("ITEM_BARREL_METAL_EMPTY");
});
it("replaces installed cage, rack, stand, nest and hive billboards with explicit models", () => {
  for (const [category, type] of [
    ["Cage", "cage"],
    ["AnimalTrap", "animaltrap"],
    ["Weaponrack", "weaponrack"],
    ["Armorstand", "armorstand"],
    ["NestBox", "nestbox"],
    ["Hive", "hive"],
  ]) {
    const c = chunk();
    const b = {
      index: 1,
      posXMin: 2,
      posXMax: 2,
      posYMin: 3,
      posYMax: 3,
      posZMax: 4,
      buildingType: {
        buildingType: 1,
        buildingSubtype: -1,
        buildingCustom: -1,
      },
    };
    const objects = buildingObjects(c, [b], new Map([["1,-1,-1", category]]), {
      get: () => sprite,
    });
    expect(objects[0]).toMatchObject({ kind: "ground", furniture: { type } });
    expect(furnitureFaces(objects[0], 4.12).length).toBeGreaterThan(6);
    c.tiles[50].shape = "unknown";
    expect(
      buildingObjects(c, [b], new Map([["1,-1,-1", category]]), {
        get: () => sprite,
      }),
    ).toEqual([]);
  }
  expect(
    sceneryMappings(
      "[TOOL_GRAPHICS:TOOLS:2:11:ITEM_TOOL_HIVE][TOOL_GRAPHICS_HIVE_BLD:TOOLS:0:11]",
    ).map((e) => e.key),
  ).toEqual(["ITEM_TOOL_HIVE", "ITEM_TOOL_HIVE_BUILDING"]);
});
