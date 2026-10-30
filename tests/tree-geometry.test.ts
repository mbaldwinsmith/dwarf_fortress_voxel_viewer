import { expect, it } from "vitest";
import {
  tileAt,
  chunkKey,
  type Tile,
  type Chunk,
  type SpriteRef,
} from "../src/shared/model.js";
import { appendTreeWood } from "../src/viewer/tree-wood.js";
import { appendTreeFoliage } from "../src/viewer/tree-foliage.js";
import {
  appendTrunkSection,
  trunkOutlines,
} from "../src/viewer/tree-section.js";
import { TreeTopology } from "../src/viewer/tree-topology.js";
import type { MeshData } from "../src/viewer/mesh.js";
const ref: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 512,
  pageHeight: 512,
};
const tile = (token = "TREE_TRUNK_PILLAR", species = "GENERIC"): Tile => ({
  shape: "wall",
  name: species,
  material: 23,
  treeGraphic: token,
  tree: {
    species,
    speciesId: species,
    bark: ref,
    side: ref,
    leaves: ref,
    cap: ref,
  },
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
const data = (): MeshData => ({ positions: [], colors: [], uvs: [] });
const uv = () => [0, 0, 1, 1] as [number, number, number, number];

it("keeps a broad section continuous across chunks and never includes a hidden neighbour", () => {
  const a = block(),
    b = block(16);
  a.tiles[15] = tile();
  b.tiles[0] = tile();
  const chunks = new Map([a, b].map((c) => [chunkKey(c), c])),
    left = data(),
    right = data();
  appendTreeWood(left, a.tiles[15], 15, 0, 4, chunks, uv);
  appendTreeWood(right, b.tiles[0], 16, 0, 4, chunks, uv);
  expect(right.positions).toHaveLength(0);
  const xs = left.positions.filter((_, i) => i % 3 === 0);
  expect(Math.min(...xs)).toBeLessThan(15.2);
  expect(Math.max(...xs)).toBeGreaterThan(16.8);
  expect(left.uvs.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(
    true,
  );
  b.tiles[0] = { ...tile(), shape: "unknown" };
  const clipped = data();
  appendTreeWood(clipped, a.tiles[15], 15, 0, 4, chunks, uv);
  expect(
    Math.max(...clipped.positions.filter((_, i) => i % 3 === 0)),
  ).toBeLessThan(16);
});

it("preserves concave and enclosed missing cells when rounding and triangulating trunk sections", () => {
  const footprints: [number, number][][] = [
    [
      [4, 4],
      [5, 4],
      [4, 5],
    ],
    [
      [4, 4],
      [5, 4],
      [6, 4],
      [4, 5],
      [6, 5],
      [4, 6],
      [5, 6],
      [6, 6],
    ],
  ];
  for (const cells of footprints) {
    const c = block(),
      occupied = new Set(cells.map((p) => p.join(",")));
    for (const [x, y] of cells) c.tiles[y * 16 + x] = tile();
    c.tiles[5 * 16 + 5] = { shape: "unknown", name: "Hidden", material: 0 };
    const chunks = new Map([[chunkKey(c), c]]),
      mesh = data();
    appendTrunkSection(mesh, tile(), cells, 4, chunks, uv);
    for (const loop of trunkOutlines(cells, 0.13))
      for (const [x, y] of loop)
        expect(occupied.has(`${Math.floor(x)},${Math.floor(y)}`)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i += 9) {
      const p = mesh.positions.slice(i, i + 9),
        x = (p[0] + p[3] + p[6]) / 3,
        y = (p[2] + p[5] + p[8]) / 3;
      expect(occupied.has(`${Math.floor(x)},${Math.floor(y)}`)).toBe(true);
    }
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
  }
});

it("resolves unspecified twigs into a connected acyclic branch hierarchy", () => {
  const c = block();
  for (let x = 4; x <= 6; x++)
    for (let y = 4; y <= 6; y++) c.tiles[y * 16 + x] = tile("TREE_TWIGS");
  c.tiles[5 * 16 + 3] = tile();
  const chunks = new Map([[chunkKey(c), c]]),
    topology = new TreeTopology(chunks);
  let edges = 0;
  for (let x = 3; x <= 6; x++)
    for (let y = 4; y <= 6; y++)
      if (tileAt(chunks, x, y, 4)?.treeGraphic)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ])
          if (
            tileAt(chunks, x + dx, y + dy, 4)?.treeGraphic &&
            topology.linked([x, y, 4], [x + dx, y + dy, 4])
          )
            edges++;
  expect(edges).toBe(9);
});

it("keeps directional dead wood bare and suppresses unknown or native-empty twigs", () => {
  const branch = tile("TREE_DEAD_BRANCH_NS"),
    wood = data(),
    leaves = data();
  appendTreeWood(wood, branch, 4, 4, 4, new Map(), uv);
  appendTreeFoliage(leaves, branch, 4, 4, 4, uv, new Map());
  const xs = wood.positions.filter((_, i) => i % 3 === 0),
    zs = wood.positions.filter((_, i) => i % 3 === 2);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.3);
  expect(Math.min(...zs)).toBeLessThanOrEqual(4.03);
  expect(Math.max(...zs)).toBeGreaterThanOrEqual(4.97);
  expect(leaves.positions).toHaveLength(0);
  for (const t of [
    { ...tile("TREE_TWIGS"), shape: "unknown" as const },
    tile("TREE_TWIGS", "BLOOD_THORN"),
    tile("TREE_TWIGS", "GLUMPRONG"),
  ]) {
    const out = data();
    appendTreeWood(out, t, 4, 4, 4, new Map(), uv);
    appendTreeFoliage(out, t, 4, 4, 4, uv, new Map());
    expect(out.positions).toHaveLength(0);
  }
});

it("emits outward facing foliage tops and finite bounded texture coordinates", () => {
  const out = data();
  appendTreeFoliage(out, tile("TREE_TWIGS"), 4, 4, 4, uv, new Map());
  let tops = 0;
  for (let i = 0; i < out.positions.length; i += 9) {
    const p = out.positions.slice(i, i + 9);
    if (Math.min(p[1], p[4], p[7]) > 4.74) {
      const ny = (p[5] - p[2]) * (p[6] - p[0]) - (p[3] - p[0]) * (p[8] - p[2]);
      expect(ny).toBeGreaterThanOrEqual(-1e-8);
      tops++;
    }
  }
  expect(tops).toBeGreaterThan(0);
  expect(out.uvs.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(
    true,
  );
  expect(out.positions.every((v) => v >= 4 && v <= 5)).toBe(true);
});

it("shows the tube annulus from above while keeping its mouth open", () => {
  const out = data();
  appendTreeWood(
    out,
    tile("TREE_TWIGS", "TUNNEL_TUBE"),
    4,
    4,
    4,
    new Map(),
    uv,
  );
  let rims = 0;
  for (let i = 0; i < out.positions.length; i += 9) {
    const p = out.positions.slice(i, i + 9);
    if ([p[1], p[4], p[7]].every((y) => Math.abs(y - 4.72) < 1e-8)) {
      const ny = (p[5] - p[2]) * (p[6] - p[0]) - (p[3] - p[0]) * (p[8] - p[2]);
      expect(ny).toBeGreaterThan(0);
      for (let j = 0; j < 9; j += 3)
        expect(Math.hypot(p[j] - 4.5, p[j + 2] - 4.5)).toBeGreaterThan(0.13);
      rims++;
    }
  }
  expect(rims).toBeGreaterThan(0);
});
