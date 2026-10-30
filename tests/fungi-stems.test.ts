import { it, expect, vi } from "vitest";
import {
  appendFungalStem,
  roundFungalStem,
} from "../src/viewer/fungi-stems.js";
import type { MeshData } from "../src/viewer/mesh.js";
import {
  chunkKey,
  type Chunk,
  type Tile,
  type SpriteRef,
} from "../src/shared/model.js";
const bark: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 544,
  pageHeight: 224,
};
const stem = (): Tile => ({
  shape: "wall",
  material: 24,
  name: "Tower cap",
  treeGraphic: "TREE_TRUNK_PILLAR",
  tree: { species: "tower-cap", bark, roundStem: true },
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
const output = (): MeshData => ({ positions: [], colors: [], uvs: [] });
it("extrudes the native circular stalk section and extends its top into both thick and thin caps", () => {
  for (const token of ["TREE_CAP_WALL_N", "TREE_CAP_FLOOR_1"]) {
    const c = block(),
      above = block(0, 5);
    c.tiles[68] = stem();
    above.tiles[68] = {
      shape: "wall",
      material: 24,
      name: "Cap",
      treeGraphic: token,
    };
    const all = new Map([c, above].map((c) => [chunkKey(c), c])),
      data = output(),
      uv = vi.fn(
        (_ref?: SpriteRef) => [0, 0, 1, 1] as [number, number, number, number],
      );
    appendFungalStem(data, c.tiles[68], 4, 4, 4, all, uv);
    const points = Array.from({ length: data.positions.length / 3 }, (_, i) =>
      data.positions.slice(i * 3, i * 3 + 3),
    );
    expect(
      points.every((p) => Math.hypot(p[0] - 4.5, p[2] - 4.5) < 0.469),
    ).toBe(true);
    const upper = Math.max(...points.map((p) => p[1]));
    expect(upper).toBeGreaterThan(5);
    expect(upper).toBeLessThan(token.includes("FLOOR") ? 5.22 : 6);
    expect(data.uvs.every(Number.isFinite)).toBe(true);
    expect(
      uv.mock.calls.some(
        ([ref]) => JSON.stringify(ref) === JSON.stringify(bark),
      ),
    ).toBe(true);
    expect(roundFungalStem({ ...stem(), shape: "unknown" })).toBe(false);
  }
});
it("joins broad multi-tile stalks across a chunk boundary as one rounded section", () => {
  const a = block(),
    b = block(16);
  a.tiles[4 * 16 + 15] = stem();
  b.tiles[4 * 16] = stem();
  const all = new Map([a, b].map((c) => [chunkKey(c), c])),
    owner = output(),
    neighbour = output();
  appendFungalStem(owner, a.tiles[79], 15, 4, 4, all, () => [0, 0, 1, 1]);
  appendFungalStem(neighbour, b.tiles[64], 16, 4, 4, all, () => [0, 0, 1, 1]);
  expect(neighbour.positions).toEqual([]);
  const xs = owner.positions.filter((_, i) => i % 3 === 0);
  expect(Math.min(...xs)).toBeLessThan(15.1);
  expect(Math.max(...xs)).toBeGreaterThan(16.9);
  expect(roundFungalStem({ ...stem(), tree: { species: "oak" } })).toBe(false);
});
