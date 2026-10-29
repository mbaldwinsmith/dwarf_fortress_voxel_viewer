import { it, expect } from "vitest";
import {
  stairDestination,
  rampDestination,
  surfaceHeight,
} from "../src/viewer/traversal.js";
import { canWalk } from "../src/viewer/first-person.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
const block = (
  z: number,
  shape: "floor" | "wall" | "empty" = "empty",
): Chunk => ({
  x: 0,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape,
    material: 2,
    name: "Terrain",
  })),
});
it("requires connected stair directions and refuses hidden or unloaded destinations", () => {
  const a = block(4),
    b = block(5),
    world = new Map([a, b].map((c) => [chunkKey(c), c]));
  a.tiles[34] = { shape: "stairs", material: 2, name: "Up Stairway" };
  b.tiles[34] = { shape: "stairs", material: 2, name: "Down Stairway" };
  expect(stairDestination(world, 2.5, 2.5, 4, 1)).toBe(5);
  expect(stairDestination(world, 2.5, 2.5, 5, -1)).toBe(4);
  expect(stairDestination(world, 2.5, 2.5, 4, -1)).toBeUndefined();
  b.tiles[34].name = "Up Stairway";
  expect(stairDestination(world, 2.5, 2.5, 4, 1)).toBeUndefined();
  b.tiles[34].shape = "unknown";
  expect(stairDestination(world, 2.5, 2.5, 4, 1)).toBeUndefined();
});
it("samples a ramp slope and walks onto its upper landing and back down", () => {
  const a = block(4),
    b = block(5),
    c = block(6),
    world = new Map([a, b, c].map((c) => [chunkKey(c), c]));
  a.tiles[34] = { shape: "ramp", material: 2, name: "Ramp" };
  a.tiles[35] = { shape: "wall", material: 2, name: "Stone" };
  b.tiles[35] = { shape: "floor", material: 2, name: "Landing" };
  expect(surfaceHeight(world, 2.1, 2.5, 4)).toBeLessThan(
    surfaceHeight(world, 2.9, 2.5, 4)!,
  );
  expect(rampDestination(world, 2.98, 2.5, 3.02, 2.5, 4)).toBe(5);
  expect(canWalk(world, 3.02, 2.5, 5)).toBe(true);
  expect(rampDestination(world, 3.02, 2.5, 2.98, 2.5, 5)).toBe(4);
  expect(canWalk(world, 2.98, 2.5, 4)).toBe(true);
  b.tiles[34] = { shape: "wall", material: 2, name: "Low ceiling" };
  expect(canWalk(world, 2.9, 2.5, 4)).toBe(false);
});
it("does not climb arbitrary walls or step off a ledge without a ramp", () => {
  const a = block(4, "floor"),
    b = block(5),
    world = new Map([a, b].map((c) => [chunkKey(c), c]));
  a.tiles[35] = { shape: "wall", material: 2, name: "Wall" };
  b.tiles[35] = { shape: "floor", material: 2, name: "Landing" };
  expect(rampDestination(world, 2.99, 2.5, 3.01, 2.5, 4)).toBeUndefined();
  a.tiles[35].shape = "empty";
  expect(rampDestination(world, 2.99, 2.5, 3.01, 2.5, 4)).toBeUndefined();
});
