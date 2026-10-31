import { expect, it } from "vitest";
import * as THREE from "three";
import { bottomPadding } from "../src/viewer/sprite-ground.js";
import { CreatureSprites } from "../src/viewer/creatures.js";
import { surfaceHeight } from "../src/viewer/traversal.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
it("anchors to the lowest rendered pixel, ignoring transparent padding and discarded alpha", () => {
  const pixels = new Uint8Array(4 * 8 * 4);
  pixels[(4 * 4 + 2) * 4 + 3] = 255;
  pixels[(7 * 4 + 2) * 4 + 3] = 76;
  expect(bottomPadding(pixels, 4, 8)).toBe(3 / 8);
  pixels[(6 * 4 + 1) * 4 + 3] = 77;
  expect(bottomPadding(pixels, 4, 8)).toBe(1 / 8);
  expect(bottomPadding(new Uint8Array(16), 2, 2)).toBe(0);
});
it("places feet on the sampled slope instead of a fixed tile-height offset", () => {
  const c: Chunk = {
    x: 0,
    y: 0,
    z: 4,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "floor",
      name: "Grass",
      material: 8,
    })),
  };
  const top: Chunk = {
    x: 0,
    y: 0,
    z: 5,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "empty",
      name: "Air",
      material: 0,
    })),
  };
  c.tiles[34] = { shape: "ramp", name: "Ramp", material: 8 };
  c.tiles[35] = { shape: "wall", name: "Rock", material: 2 };
  top.tiles[35] = { shape: "floor", name: "Landing", material: 8 };
  const chunks = new Map([c, top].map((c) => [chunkKey(c), c])),
    sprites = new CreatureSprites();
  try {
    sprites.snapshot({
      type: "creatures",
      session: "a",
      tick: 1,
      creatures: [{ id: 1, x: 2, y: 2, z: 4, name: "Dwarf" }],
    });
    const sprite = sprites.group.children[0] as THREE.Sprite;
    sprite.material.userData.bottomPadding = 0.25;
    sprites.update(chunks, 4);
    expect(sprite.position.y).toBeCloseTo(surfaceHeight(chunks, 2.5, 2.5, 4)!);
    expect(sprite.position.y).toBeGreaterThan(4.5);
    expect(sprite.center.y).toBe(0.25);
  } finally {
    sprites.dispose();
  }
});

it("measures visible horizontal bounds using the same alpha cutoff as the renderer", async () => {
  const { horizontalPadding } = await import("../src/viewer/sprite-ground.js");
  const pixels = new Uint8Array(8 * 4 * 4);
  pixels[(1 * 8 + 2) * 4 + 3] = 255;
  pixels[(2 * 8 + 5) * 4 + 3] = 77;
  pixels[(3 * 8 + 7) * 4 + 3] = 76;
  expect(horizontalPadding(pixels, 8, 4)).toEqual([0.25, 0.25]);
  expect(horizontalPadding(new Uint8Array(8 * 4 * 4), 8, 4)).toEqual([0, 0]);
});
