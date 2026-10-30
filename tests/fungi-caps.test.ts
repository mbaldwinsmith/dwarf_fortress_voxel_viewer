import { it, expect } from "vitest";
import { buildFungiCaps, type FungiData } from "../src/viewer/fungi-caps.js";
import { buildMesh } from "../src/viewer/mesh.js";
import {
  chunkKey,
  type Chunk,
  type Tile,
  type SpriteRef,
} from "../src/shared/model.js";
const ref: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 96,
  width: 32,
  height: 32,
  pageWidth: 544,
  pageHeight: 224,
};
const cap = (token = "TREE_CAP_WALL_N"): Tile => ({
  shape: token.includes("FLOOR") ? "floor" : "wall",
  material: 24,
  name: "Tower cap",
  treeGraphic: token,
  tree: { species: "tower-cap", cap: ref, capSurface: ref, bark: ref },
});
const block = (x = 0, z = 4): Chunk => ({
  x,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
const uv = () => [0.1, 0.2, 0.3, 0.4] as [number, number, number, number];
function manifold(meshes: FungiData[]) {
  const edges = new Map<string, number>();
  for (const mesh of meshes)
    for (let i = 0; i < mesh.positions.length; i += 9) {
      const points = [0, 3, 6].map((k) =>
        mesh.positions
          .slice(i + k, i + k + 3)
          .map((v) => Math.round(v * 1e5))
          .join(","),
      );
      for (let j = 0; j < 3; j++) {
        const key = [points[j], points[(j + 1) % 3]].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  return [...edges.values()].every((n) => n === 2);
}
it("builds a closed, curved single cap including thin cap floors, with textured centre and underside", () => {
  for (const token of ["TREE_CAP_WALL_N", "TREE_CAP_FLOOR_1"]) {
    const c = block();
    c.tiles[68] = cap(token);
    const all = new Map([[chunkKey(c), c]]),
      data = buildFungiCaps(c, all, uv);
    expect(data.positions.length).toBeGreaterThan(0);
    expect(manifold([data])).toBe(true);
    expect(data.normals.length).toBe(data.positions.length);
    expect(data.caps.length).toBe((data.positions.length / 3) * 4);
    expect(data.caps.every(Number.isFinite)).toBe(true);
    expect(data.normals.some((v, i) => i % 3 === 1 && v < -0.9)).toBe(true);
    expect(
      data.normals.some((v) => Math.abs(v) > 0.1 && Math.abs(v) < 0.9),
    ).toBe(true);
    expect(buildMesh(c, all, 4, uv, true).fungi?.positions).toEqual(
      data.positions,
    );
    expect(buildMesh(c, all, 4, uv, true).positions).toEqual([]);
  }
});
it("joins cap surfaces watertight across horizontal chunk boundaries and z-levels", () => {
  const all = new Map<string, Chunk>();
  for (const x of [0, 16])
    for (const z of [3, 4, 5, 6, 7]) {
      const c = block(x, z);
      if (z >= 4 && z <= 6)
        c.tiles[4 * 16 + (x === 0 ? 15 : 0)] = cap(
          z === 6 ? "TREE_CAP_FLOOR_1" : "TREE_CAP_WALL_N",
        );
      all.set(chunkKey(c), c);
    }
  const meshes = [...all.values()].map((c) => buildFungiCaps(c, all, uv));
  expect(manifold(meshes)).toBe(true);
  expect(
    meshes.some((mesh) =>
      mesh.positions.some((v, i) => i % 3 === 0 && Math.abs(v - 16) < 1e-6),
    ),
  ).toBe(true);
});
it("closes an orbit cutaway without internal floor/side panels in the full first-person cap", () => {
  const a = block(),
    b = block(0, 5);
  a.tiles[68] = cap();
  b.tiles[68] = cap();
  const all = new Map([a, b].map((c) => [chunkKey(c), c]));
  const cut = buildFungiCaps(a, all, uv, true);
  expect(manifold([cut])).toBe(true);
  const full = buildFungiCaps(a, all, uv);
  expect(full.positions.length).toBeLessThan(cut.positions.length);
});
it("does not mesh undiscovered caps or bridge separate cap layers across empty levels", () => {
  const a = block(),
    b = block(0, 6);
  a.tiles[68] = { ...cap(), shape: "unknown" };
  b.tiles[68] = cap();
  const all = new Map([a, b].map((c) => [chunkKey(c), c]));
  expect(buildFungiCaps(a, all, uv).positions).toEqual([]);
  const distant = block(0, 8);
  distant.tiles[68] = cap();
  all.set(chunkKey(distant), distant);
  const gap = block(0, 7);
  all.set(chunkKey(gap), gap);
  expect(buildFungiCaps(gap, all, uv).positions).toEqual([]);
});
