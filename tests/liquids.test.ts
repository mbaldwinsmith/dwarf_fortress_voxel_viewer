import { expect, it } from "vitest";
import { convertBlock } from "../src/bridge/adapter.js";
import { type } from "../src/bridge/protocol.js";
import { liquidGeometry, LiquidMeshes } from "../src/viewer/liquids.js";
import * as THREE from "three";
import { textureTerrain } from "../src/bridge/terrain-art.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
const block = (z = 4): Chunk => ({
  x: 0,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
it.each([1, 2, 3, 4, 5, 6, 7])("fills exactly %s/7 of a voxel", (depth) => {
  const c = block();
  c.tiles[0].liquid = { kind: "water", depth };
  const p = liquidGeometry(c, new Map([[chunkKey(c), c]]), "water");
  expect(Math.max(...p.filter((_, i) => i % 3 === 1))).toBeCloseTo(
    c.z + depth / 7,
  );
});
it("decodes actual liquid wire fields and strips hidden deposits", () => {
  const raw = {
    mapX: 0,
    mapY: 0,
    mapZ: 4,
    tiles: Array(256).fill(1),
    hidden: Array(256).fill(false),
    water: Array(256).fill(0),
    magma: Array(256).fill(0),
  };
  raw.water[0] = 3;
  raw.magma[1] = 7;
  raw.magma[2] = 6;
  raw.hidden[2] = true;
  const schema = type("RemoteFortressReader.MapBlock");
  const decoded = schema.toObject(schema.decode(schema.encode(raw).finish()));
  const c = convertBlock(
    decoded,
    0,
    0,
    4,
    new Map([[1, { shape: 1, material: 2, name: "Stone" }]]),
  );
  expect(c.tiles[0].liquid).toEqual({ kind: "water", depth: 3 });
  expect(c.tiles[1].liquid).toEqual({ kind: "magma", depth: 7 });
  expect(c.tiles[2]).toEqual({
    shape: "unknown",
    material: 0,
    name: "Undiscovered",
  });
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "a",
      sequence: 1,
      pollMs: 1,
      chunks: [c],
    }),
  ).not.toThrow();
  c.tiles[2].liquid = { kind: "water", depth: 8 };
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "a",
      sequence: 1,
      pollMs: 1,
      chunks: [c],
    }),
  ).toThrow();
});
it("culls equal-depth chunk seams and preserves a cutaway water surface", () => {
  const a = block(),
    b = block(),
    above = block(5);
  b.x = 16;
  a.tiles[15].liquid =
    b.tiles[0].liquid =
    above.tiles[15].liquid =
      { kind: "water", depth: 7 };
  const all = new Map([a, b, above].map((c) => [chunkKey(c), c]));
  expect(liquidGeometry(a, all, "water")).toHaveLength(3 * 18);
  expect(liquidGeometry(a, all, "water", 4)).toHaveLength(4 * 18);
  a.tiles[15].shape = "unknown";
  expect(liquidGeometry(a, all, "water")).toHaveLength(0);
});
it("uses the native depth-specific water texture and a translucent basic material", () => {
  const c = block(),
    tex = new THREE.Texture(),
    surface = {
      asset: "b".repeat(24),
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      pageWidth: 32,
      pageHeight: 32,
    };
  c.tiles[0].liquid = { kind: "water", depth: 3 };
  const requested: string[] = [];
  textureTerrain(c, {
    get: (key) => {
      requested.push(key);
      return surface;
    },
  });
  expect(requested).toContain("UNDERWATER_3");
  expect(c.tiles[0].liquid.surface).toBe(surface);
  const meshes = new LiquidMeshes(tex, () => [0, 0, 1, 1]);
  try {
    meshes.update([c], new Map([[chunkKey(c), c]]), 4);
    const mesh = meshes.group.children[0].children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(mesh.material.isMeshBasicMaterial).toBe(true);
    expect(mesh.material.map).toBe(tex);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.opacity).toBeLessThan(1);
    expect(mesh.geometry.getAttribute("uv").count).toBe(
      mesh.geometry.getAttribute("position").count,
    );
  } finally {
    meshes.dispose();
    tex.dispose();
  }
});
