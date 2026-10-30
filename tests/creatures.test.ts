import { it, expect } from "vitest";
import { parseGraphics, permittedImage } from "../src/bridge/graphics.js";
import { visibleUnit } from "../src/bridge/creatures.js";
import { CreatureSprites } from "../src/viewer/creatures.js";
import * as THREE from "three";
import { parseServerMessage } from "../src/shared/validation.js";
import { type Chunk } from "../src/shared/model.js";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
it("writes opaque sprite pixels to depth so water cannot paint over foreground creatures", () => {
  const sprites = new CreatureSprites();
  try {
    sprites.snapshot({
      type: "creatures",
      session: "a",
      tick: 1,
      creatures: [{ id: 1, x: 0, y: 0, z: 0, name: "Dwarf" }],
    });
    const material = (sprites.group.children[0] as THREE.Sprite).material;
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.alphaTest).toBeGreaterThan(0);
  } finally {
    sprites.dispose();
  }
});
it("resolves simple and caste definitions without treating layered graphics as flat sprites", () => {
  const p = parseGraphics(
    "[TILE_PAGE:ANIMALS][FILE:images/animals.png][TILE_DIM:32:32][PAGE_DIM_PIXELS:128:128]\n[CREATURE_GRAPHICS:TEST][DEFAULT:ANIMALS:2:1:AS_IS]\n[CREATURE_CASTE_GRAPHICS:BIRD:FEMALE][DEFAULT:ANIMALS:0:0:AS_IS]\n[CREATURE_GRAPHICS:LAYERED][LAYER_SET:DEFAULT][DEFAULT:ANIMALS:0:0:AS_IS]",
  );
  expect(p.pages.get("ANIMALS")?.file).toBe("images/animals.png");
  expect(p.sprites.get("TEST")).toEqual({ page: "ANIMALS", x: 2, y: 1 });
  expect(p.sprites.has("BIRD:FEMALE")).toBe(true);
  expect(p.sprites.has("LAYERED")).toBe(false);
});
it("allows images only inside the selected graphics root", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "deepwatch-art-"));
  try {
    await mkdir(path.join(dir, "images"));
    await writeFile(path.join(dir, "images", "test.png"), "synthetic");
    expect(await permittedImage(dir, "images/test.png")).toContain("test.png");
    for (const bad of [
      "../secret.png",
      "images/../../secret.png",
      "C:/secret.png",
      "images/test.txt",
      "images/..\\secret.png",
    ])
      await expect(permittedImage(dir, bad)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
const b = { x: 0, y: 0, z: 0, width: 16, depth: 16, height: 10 };
const c: Chunk = {
  x: 0,
  y: 0,
  z: 3,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Stone",
  })),
};
const chunks = new Map([["0,0,3", c]]);
const u = { id: 1, posX: 2, posY: 2, posZ: 3, flags1: 0 };
it("filters undiscovered, unstreamed, off-region, inactive and ambushing creatures", () => {
  expect(visibleUnit(u, b, 3, chunks)).toBe(true);
  for (const flags1 of [2, 1 << 8, 1 << 10, 1 << 18, 1 << 21, 1 << 25])
    expect(visibleUnit({ ...u, flags1 }, b, 3, chunks)).toBe(false);
  expect(visibleUnit({ ...u, posX: 20 }, b, 3, chunks)).toBe(false);
  expect(visibleUnit({ ...u, posZ: 4 }, b, 3, chunks)).toBe(false);
  expect(visibleUnit(u, b, 3, new Map())).toBe(false);
  const hidden: Chunk = {
    ...c,
    tiles: c.tiles.map((t) => ({ ...t, shape: "unknown" })),
  };
  expect(visibleUnit(u, b, 3, new Map([["0,0,3", hidden]]))).toBe(false);
});
it("replaces unit snapshots, resets sessions and uses depth-tested camera-facing sprites", () => {
  const layer = new CreatureSprites();
  const unit = { id: 1, x: 2, y: 2, z: 3, name: "Test" };
  layer.snapshot({
    type: "creatures",
    session: "a",
    tick: 1,
    creatures: [unit],
  });
  layer.update(chunks, 3);
  expect(layer.visibleCount).toBe(1);
  const object = layer.group.children[0];
  expect(object.type).toBe("Sprite");
  expect(object.position.toArray()).toEqual([2.5, 3.12, 2.5]);
  layer.snapshot({ type: "creatures", session: "a", tick: 1, creatures: [] });
  expect(layer.group.children).toHaveLength(1);
  layer.snapshot({ type: "creatures", session: "a", tick: 2, creatures: [] });
  expect(layer.group.children).toHaveLength(0);
  layer.snapshot({
    type: "creatures",
    session: "b",
    tick: 1,
    creatures: [unit],
  });
  layer.update(chunks, 2);
  expect(layer.visibleCount).toBe(0);
  layer.dispose();
  expect(layer.group.children).toHaveLength(0);
});
it("rejects unsafe sprite references at the browser boundary", () => {
  const unit = {
    id: 1,
    x: 0,
    y: 0,
    z: 0,
    name: "Test",
    sprite: {
      asset: "../secret",
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      pageWidth: 32,
      pageHeight: 32,
    },
  };
  expect(() =>
    parseServerMessage({
      type: "creatures",
      session: "a",
      tick: 1,
      creatures: [unit],
    }),
  ).toThrow();
});
