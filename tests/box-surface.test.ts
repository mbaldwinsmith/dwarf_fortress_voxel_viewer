import { expect, it } from "vitest";
import { exposedBoxFaces } from "../src/viewer/box-surface.js";
import type { TreeBox } from "../src/viewer/trees.js";
import { buildMesh } from "../src/viewer/mesh.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
import { parseServerMessage } from "../src/shared/validation.js";
const box = (extra: Partial<TreeBox> = {}): TreeBox => ({
  x: 0,
  y: 0,
  z: 0,
  w: 1,
  h: 1,
  d: 1,
  part: "bark",
  ...extra,
});
it("removes duplicate and shared faces without opening holes in adjoining trunks", () => {
  expect(exposedBoxFaces([box(), box()])).toHaveLength(6);
  const adjacent = exposedBoxFaces([box(), box({ x: 1 })]);
  expect(adjacent).toHaveLength(10);
  expect(adjacent.some((f) => f.vertices.every((v) => v[0] === 1))).toBe(false);
});
it("emits only the exterior of intersecting fungi branches with bounded UV crops", () => {
  const faces = exposedBoxFaces([
    box({ x: 0.425, y: 0.2, w: 0.15, h: 0.15 }),
    box({ z: 0.425, y: 0.2, h: 0.15, d: 0.15 }),
  ]);
  let area = 0;
  for (const f of faces) {
    const a = f.vertices[1].map((v, i) => v - f.vertices[0][i]),
      b = f.vertices[3].map((v, i) => v - f.vertices[0][i]);
    area += Math.hypot(
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    );
    expect(f.crop.every((v) => v >= 0 && v <= 1)).toBe(true);
  }
  expect(area).toBeCloseTo(1.155, 8);
  // No pair of exterior polygons may occupy a positive shared planar area.
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i].vertices,
        b = faces[j].vertices;
      const axis = [0, 1, 2].find((k) =>
        a.every((v) => Math.abs(v[k] - a[0][k]) < 1e-8),
      );
      if (
        axis === undefined ||
        !b.every((v) => Math.abs(v[axis] - a[0][axis]) < 1e-8)
      )
        continue;
      const extents = [0, 1, 2]
        .filter((k) => k !== axis)
        .map(
          (k) =>
            Math.min(
              Math.max(...a.map((v) => v[k])),
              Math.max(...b.map((v) => v[k])),
            ) -
            Math.max(
              Math.min(...a.map((v) => v[k])),
              Math.min(...b.map((v) => v[k])),
            ),
        );
      expect(extents.some((v) => v < 1e-8)).toBe(true);
    }
});
it("keeps opaque bark behind alpha-cutout foliage", () => {
  expect(
    exposedBoxFaces([
      box({ x: 0.2, y: 0.2, z: 0.2, w: 0.6, h: 0.6, d: 0.6 }),
      box({ part: "leaves" }),
    ]).filter((f) => f.box === 0),
  ).toHaveLength(6);
});
it("textures sealed ceilings over open space without using their hidden materials", () => {
  const ref: SpriteRef = {
    asset: "a".repeat(24),
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    pageWidth: 32,
    pageHeight: 32,
  };
  const c: Chunk = {
    x: 0,
    y: 0,
    z: 5,
    ceilingTexture: ref,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "empty",
      material: 0,
      name: "Air",
    })),
  };
  c.tiles[0] = { shape: "wall", material: 2, name: "Solid rock", sealed: true };
  const requested: (SpriteRef | undefined)[] = [];
  const mesh = buildMesh(
    c,
    new Map([["0,0,5", c]]),
    4,
    (r) => {
      requested.push(r);
      return [0, 0, 1, 1];
    },
    true,
  );
  expect(requested).toContain(ref);
  expect(
    mesh.positions.filter((_, i) => i % 3 === 1 && mesh.positions[i] === 5)
      .length,
  ).toBeGreaterThan(0);
  const message = {
    type: "chunks",
    session: "test",
    sequence: 1,
    pollMs: 0,
    chunks: [c],
  };
  expect(() => parseServerMessage(message)).not.toThrow();
  c.ceilingTexture = { ...ref, asset: "invalid" };
  expect(() => parseServerMessage(message)).toThrow();
});
it("gives overlapping neighbour-aware wall rims distinct depth layers", () => {
  const ref: SpriteRef = {
    asset: "a".repeat(24),
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    pageWidth: 32,
    pageHeight: 32,
  };
  const c: Chunk = {
    x: 0,
    y: 0,
    z: 5,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "empty",
      material: 0,
      name: "Air",
    })),
  };
  c.tiles[0] = {
    shape: "wall",
    material: 2,
    name: "Wall",
    wallRim: [ref, { ...ref, x: 32, pageWidth: 64 }],
  };
  const mesh = buildMesh(c, new Map([["0,0,5", c]]), 5);
  const layers = new Set(mesh.positions.filter((v, i) => i % 3 === 1 && v > 6));
  expect([...layers].sort()).toEqual([6.004, 6.005]);
});
