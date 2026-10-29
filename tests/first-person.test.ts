import { it, expect } from "vitest";
import { canWalk, walkingHeight } from "../src/viewer/first-person.js";
import { buildMesh } from "../src/viewer/mesh.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
const chunk = (
  x = 0,
  z = 4,
  shape: "floor" | "wall" | "unknown" | "empty" = "floor",
): Chunk => ({
  x,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape,
    material: 2,
    name: "Terrain",
  })),
});
const world = (...chunks: Chunk[]) =>
  new Map(chunks.map((c) => [chunkKey(c), c]));
it("requires revealed walkable ground and loaded overhead, including across chunk seams", () => {
  const a = chunk(),
    b = chunk(16),
    roof = chunk(0, 5, "unknown"),
    roof2 = chunk(16, 5, "wall");
  const all = world(a, b, roof, roof2);
  expect(canWalk(all, 15.95, 4.5, 4)).toBe(true);
  expect(canWalk(world(a, roof), 15.95, 4.5, 4)).toBe(false);
  expect(canWalk(world(a), 2.5, 4.5, 4)).toBe(false);
  expect(canWalk(world(a), 2.5, 4.5, 4, 4)).toBe(true);
  a.tiles[4 * 16 + 2].shape = "unknown";
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(false);
  expect(walkingHeight(all, 3.5, 4.5, 4)).toBe(4.12);
});
it("blocks wall clipping at the player radius and low ramp headroom", () => {
  const a = chunk(),
    roof = chunk(0, 5, "wall");
  a.tiles[4 * 16 + 3].shape = "wall";
  const all = world(a, roof);
  expect(canWalk(all, 2.9, 4.5, 4)).toBe(false);
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(true);
  a.tiles[4 * 16 + 2].shape = "ramp";
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(false);
});
it("adds downward ceiling faces only in first person and only underneath overhead solids", () => {
  const floor = chunk(),
    roof = chunk(0, 5, "empty");
  roof.tiles[2].shape = "unknown";
  roof.tiles[3].shape = "wall";
  const all = world(floor, roof);
  expect(buildMesh(roof, all, 4).positions).toHaveLength(0);
  const mesh = buildMesh(roof, all, 4, undefined, true);
  expect(mesh.positions).toHaveLength(36);
  expect(
    mesh.positions.filter((_, i) => i % 3 === 1).every((y) => y === 5),
  ).toBe(true);
  const [a, b, c] = [0, 3, 6].map((i) => mesh.positions.slice(i, i + 3));
  const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  expect(normalY).toBeLessThan(0);
  expect(buildMesh(roof, all, 3, undefined, true).positions).toHaveLength(0);
  roof.tiles[2].shape = "stairs";
  expect(buildMesh(roof, all, 4, undefined, true).positions).toHaveLength(18);
});
