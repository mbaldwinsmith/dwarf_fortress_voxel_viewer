import { expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  creatureCeilingFit,
  smoothCreatureFit,
} from "../src/viewer/creature-scale.js";
import { CreatureSprites } from "../src/viewer/creatures.js";
import { topPadding } from "../src/viewer/sprite-ground.js";
import { chunkKey, type Chunk, type Shape } from "../src/shared/model.js";
function chunk(z: number, shape: Shape): Chunk {
  return {
    x: 0,
    y: 0,
    z,
    tiles: Array.from({ length: 256 }, () => ({
      shape,
      material: 2,
      name: shape,
    })),
  };
}
it("fits against rock, floors, ramp undersides and hidden rock, but leaves stair openings clear", () => {
  for (const shape of [
    "wall",
    "floor",
    "ramp",
    "unknown",
    "stairs",
    "empty",
  ] as Shape[]) {
    const c = chunk(5, shape),
      all = new Map([[chunkKey(c), c]]);
    expect(creatureCeilingFit(all, 2, 2, 4.12, 2.4)).toBeCloseTo(
      ["stairs", "empty"].includes(shape) ? 1 : 0.855 / 2.4,
    );
  }
  expect(creatureCeilingFit(new Map(), 2, 2, 4.12, 2.4)).toBe(1);
});
it("finds higher ceilings and starts above elevated ramp feet", () => {
  const c = chunk(6, "floor"),
    lower = chunk(5, "floor"),
    all = new Map([c, lower].map((c) => [chunkKey(c), c]));
  expect(creatureCeilingFit(all, 2, 2, 5.12, 2.4)).toBeCloseTo(0.855 / 2.4);
  all.delete(chunkKey(lower));
  expect(creatureCeilingFit(all, 2, 2, 4.12, 2.4)).toBeCloseTo(1.855 / 2.4);
  expect(creatureCeilingFit(all, 2, 2, 4.12, 0.5)).toBe(1);
});
it("eases recovery consistently at different frame rates and enforces a new ceiling immediately", () => {
  const run = (hz: number) => {
    let fit = 0.35;
    for (let i = 0; i < hz; i++) fit = smoothCreatureFit(fit, 1, 1 / hz);
    return fit;
  };
  expect(run(30)).toBeCloseTo(run(120), 10);
  expect(run(60)).toBeGreaterThan(0.99);
  expect(smoothCreatureFit(1, 0.4, 1 / 60)).toBe(0.4);
  expect(smoothCreatureFit(0.4, 1, 0)).toBe(0.4);
});
it("keeps the visible sprite below a cutaway-hidden ceiling, then grows without foot drift or snapshot resets", () => {
  const load = vi
    .spyOn(THREE.TextureLoader.prototype, "load")
    .mockReturnValue(new THREE.Texture<HTMLImageElement>());
  const view = new CreatureSprites(),
    floor = chunk(4, "floor"),
    ceiling = chunk(5, "empty");
  ceiling.tiles[2 + 2 * 16] = { shape: "wall", name: "Ceiling", material: 2 };
  const all = new Map([floor, ceiling].map((c) => [chunkKey(c), c]));
  const unit = {
    id: 1,
    x: 2,
    y: 2,
    z: 4,
    name: "Yak",
    bodySize: 700000,
    sprite: {
      asset: "a".repeat(24),
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      pageWidth: 32,
      pageHeight: 32,
    },
  };
  const send = (tick: number, x = 2) =>
    view.snapshot({
      type: "creatures",
      session: "ceiling",
      tick,
      creatures: [{ ...unit, x }],
    });
  try {
    send(1);
    const sprite = view.group.children[0] as THREE.Sprite,
      natural = sprite.scale.y;
    sprite.material.userData.bottomPadding = 0.25;
    sprite.material.userData.topPadding = 0.25;
    view.update(all, 4, -1, 0); // ceiling z=5 is hidden by the cutaway, still physical
    expect(sprite.position.y).toBe(4.12);
    expect(sprite.center.y).toBe(0.25);
    expect(sprite.position.y + sprite.scale.y * 0.5).toBeCloseTo(4.975);
    expect(sprite.scale.y).toBeCloseTo(0.855 / 0.5);
    expect(sprite.scale.x / sprite.scale.y).toBeCloseTo(1);
    const fitted = sprite.scale.y;
    send(2, 3);
    view.update(all, 4, -1, 1000 / 60);
    expect(sprite.scale.y).toBeGreaterThan(fitted);
    expect(sprite.scale.y).toBeLessThan(natural);
    expect(view.animating).toBe(true);
    for (let i = 2; i <= 120; i++) {
      if (i % 10 === 0) send(i + 2, 3);
      view.update(all, 4, -1, (i * 1000) / 60);
      expect(sprite.position.y).toBe(4.12);
      expect(sprite.center.y).toBe(0.25);
    }
    expect(sprite.scale.y).toBeCloseTo(natural);
    expect(view.animating).toBe(false);
    send(200);
    view.update(all, 4, -1, 2100);
    expect(sprite.position.y + sprite.scale.y * 0.5).toBeLessThanOrEqual(
      4.975000001,
    );
  } finally {
    view.dispose();
    load.mockRestore();
  }
});
it("ignores faint discarded pixels when finding the top of the visible sprite", () => {
  const pixels = new Uint8Array(4 * 8 * 4);
  pixels[3] = 76;
  pixels[(2 * 4 + 1) * 4 + 3] = 77;
  expect(topPadding(pixels, 4, 8)).toBe(0.25);
  expect(topPadding(new Uint8Array(16), 2, 2)).toBe(0);
});
