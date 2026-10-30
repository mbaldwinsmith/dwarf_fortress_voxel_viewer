import { expect, it } from "vitest";
import { treeBoxes, treeGround } from "../src/viewer/trees.js";
import { blockOrder } from "../src/bridge/region.js";
import {
  retainChunks,
  chunkKey,
  type Chunk,
  type Tile,
} from "../src/shared/model.js";
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
const trunk = (): Tile => ({
  shape: "wall",
  material: 23,
  name: "Oak",
  treeGraphic: "TREE_TRUNK_THICK_E",
  tree: { species: "oak" },
});
it("joins a broad trunk across a chunk seam without replacing it with posts", () => {
  const a = block(),
    b = block(16);
  a.tiles[15] = trunk();
  b.tiles[0] = trunk();
  const all = new Map([a, b].map((c) => [chunkKey(c), c]));
  const left = treeBoxes(a.tiles[15], 15, 0, 4, all)[0],
    right = treeBoxes(b.tiles[0], 16, 0, 4, all)[0];
  expect(15 + left.x + left.w).toBe(16 + right.x);
  expect(left.h).toBe(1);
});
it("preserves branch directions and leafless dead wood", () => {
  const t: Tile = {
    shape: "wall",
    name: "Branch",
    material: 23,
    treeGraphic: "TREE_DEAD_BRANCH_NS",
  };
  const parts = treeBoxes(t, 1, 1, 4, new Map());
  expect(Math.min(...parts.map((p) => p.z))).toBe(0);
  expect(Math.max(...parts.map((p) => p.z + p.d))).toBe(1);
  expect(parts.every((p) => p.part === "bark" && p.w < 0.2)).toBe(true);
  t.shape = "unknown";
  expect(treeBoxes(t, 1, 1, 4, new Map())).toEqual([]);
});
it("renders giant mushroom caps as solid volumes, not leafy trees", () => {
  const t: Tile = {
    shape: "floor",
    name: "Tower cap",
    material: 24,
    treeGraphic: "TREE_CAP_FLOOR_1",
  };
  const parts = treeBoxes(t, 1, 1, 4, new Map());
  expect(parts).toHaveLength(1);
  expect(parts[0].part).toBe("cap");
  expect(parts[0].w).toBe(1);
  expect(parts[0].h).toBeGreaterThan(0.1);
});
it("fills ground around rooted trunks without adding floating floors to branches", () => {
  const c = block(),
    below = block(0, 3),
    root = trunk();
  root.tree!.progress = 0;
  c.tiles[17] = root;
  c.tiles[18] = { shape: "floor", material: 8, name: "Grass" };
  below.tiles[17] = { shape: "wall", material: 2, name: "Rock" };
  const all = new Map([c, below].map((c) => [chunkKey(c), c]));
  expect(treeGround(root, 1, 1, 4, all)).toBe(c.tiles[18]);
  const branch = { ...root, treeGraphic: "TREE_BRANCH_NS" };
  expect(treeGround(branch, 1, 1, 4, all)).toBeUndefined();
});
it("retains crowns and lower terrain across all columns within the shared vertical window", () => {
  const bounds = { x: 0, y: 0, z: 0, width: 192, depth: 192, height: 199 };
  const order = blockOrder(bounds, 128, { x: 40, y: 40 });
  expect(order).toHaveLength(2304);
  expect(order).toContainEqual([32, 32, 138]);
  expect(order).toContainEqual([176, 176, 138]);
  expect(order).not.toContainEqual([32, 32, 139]);
  const chunks = new Map(
    order.map(([x, y, z]) => {
      const c = block(x, z);
      c.y = y;
      return [chunkKey(c), c] as const;
    }),
  );
  retainChunks(chunks, bounds, 129);
  expect(chunks.has("32,32,138")).toBe(true);
  expect(chunks.has("0,0,138")).toBe(true);
  expect(chunks.has("32,32,123")).toBe(false);
});
