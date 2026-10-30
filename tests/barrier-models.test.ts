import { it, expect } from "vitest";
import * as THREE from "three";
import { furnitureFaces } from "../src/viewer/furniture.js";
import { buildingObjects, SceneryReader } from "../src/bridge/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
import type {
  Chunk,
  FurnitureType,
  SceneryObject,
  SpriteRef,
} from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 32,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 384,
  pageHeight: 128,
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
const object = (type: FurnitureType, open: boolean): SceneryObject => ({
  id: "b:1",
  x: 2,
  y: 3,
  z: 4,
  name: type,
  kind: "ground",
  sprite,
  furniture: { type, open },
});
function hits(
  type: FurnitureType,
  open: boolean,
  vertical: boolean,
  axisZ = false,
  gap = false,
) {
  const faces = furnitureFaces(object(type, open), 4.12, axisZ);
  const positions = faces.flatMap((f) => [
    ...f.positions.slice(0, 9),
    ...f.positions.slice(0, 3),
    ...f.positions.slice(6, 12),
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    mesh = new THREE.Mesh(g, m);
  const ray = vertical
    ? new THREE.Raycaster(
        new THREE.Vector3(gap ? 2.33 : 2.5, 6, gap ? 3.33 : 3.5),
        new THREE.Vector3(0, -1, 0),
      )
    : axisZ
      ? new THREE.Raycaster(
          new THREE.Vector3(4, 4.52, 3.5),
          new THREE.Vector3(-1, 0, 0),
        )
      : new THREE.Raycaster(
          new THREE.Vector3(2.5, 4.52, 2),
          new THREE.Vector3(0, 0, 1),
        );
  const count = ray.intersectObject(mesh).length;
  g.dispose();
  m.dispose();
  return count;
}
it("opens real passageways in both wall orientations and shaft covers", () => {
  for (const type of ["door", "floodgate", "gratewall"] as const)
    for (const axis of [false, true]) {
      expect(hits(type, false, false, axis)).toBeGreaterThan(0);
      expect(hits(type, true, false, axis)).toBe(0);
    }
  for (const type of ["hatch", "gratefloor"] as const) {
    expect(hits(type, false, true)).toBeGreaterThan(0);
    expect(hits(type, true, true)).toBe(0);
  }
  expect(hits("gratefloor", false, true, false, true)).toBe(0);
});
it("uses native state flags over open shafts and rejects hidden barriers", () => {
  for (const category of [
    "Door",
    "Hatch",
    "GrateFloor",
    "GrateWall",
    "Floodgate",
  ]) {
    const c = chunk();
    c.tiles[50].shape = "empty";
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
      active: 0,
    };
    const defs = new Map([["1,-1,-1", category]]);
    for (const active of [0, 1, undefined]) {
      c.objects = buildingObjects(c, [{ ...b, active }], defs, {
        get: () => sprite,
      });
      expect(c.objects[0].furniture).toMatchObject({
        type: category.toLowerCase(),
        open: active === 0,
      });
      expect(() =>
        parseServerMessage({
          type: "chunks",
          session: "s",
          sequence: 1,
          pollMs: 200,
          chunks: [c],
        }),
      ).not.toThrow();
    }
    c.tiles[50].shape = "unknown";
    expect(buildingObjects(c, [b], defs, { get: () => sprite })).toEqual([]);
  }
});
it("replaces changed and deleted building models while retaining other scenery", () => {
  const reader = new SceneryReader(
    {} as never,
    { get: () => sprite } as never,
    { x: 0, y: 0, z: 0, width: 16, depth: 16, height: 10 },
  );
  (reader as any).definitions = new Map([["1,-1,-1", "Door"]]);
  const c = chunk(),
    b = {
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
      active: 1,
    };
  c.objects = [
    { id: "p:1", x: 3, y: 3, z: 4, kind: "plant", name: "Plant", sprite },
  ];
  const closed = reader.withBuildings(c, [b]),
    open = reader.withBuildings(closed, [{ ...b, active: 0 }]);
  expect(closed.objects?.[0].furniture?.open).toBe(false);
  expect(open.objects?.[0].furniture?.open).toBe(true);
  expect(open.tiles).toBe(c.tiles);
  expect(reader.withBuildings(open, []).objects?.map((o) => o.id)).toEqual([
    "p:1",
  ]);
});
