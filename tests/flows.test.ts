import { expect, it } from "vitest";
import * as THREE from "three";
import { visibleFlows } from "../src/bridge/flows.js";
import { type } from "../src/bridge/protocol.js";
import { FlowSprites } from "../src/viewer/flows.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
const block = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "empty",
    material: 0,
    name: "Air",
  })),
});
it("decodes live flow wire fields, filtering hidden, dead, empty and out-of-block effects", () => {
  const c = block();
  c.tiles[1].shape = "unknown";
  const raw = [
    { type: 5, density: 75, pos: { x: 0, y: 0, z: 4 } },
    { type: 7, density: 70, pos: { x: 1, y: 0, z: 4 } },
    { type: 2, density: 40, pos: { x: 2, y: 0, z: 4 }, dead: true },
    { type: 1, density: 0, pos: { x: 3, y: 0, z: 4 } },
    { type: 7, density: 100, pos: { x: 16, y: 0, z: 4 } },
  ];
  const schema = type("RemoteFortressReader.MapBlock");
  const result = schema.toObject(
    schema.decode(
      schema.encode({ mapX: 0, mapY: 0, mapZ: 4, flows: raw }).finish(),
    ),
  );
  expect(visibleFlows(result.flows, c)).toEqual([
    { kind: "smoke", density: 75, x: 0, y: 0, z: 4 },
  ]);
});
it("animates native sprites with bounded batches and removes stale effects", () => {
  const c = block();
  c.flows = [
    {
      x: 0,
      y: 0,
      z: 4,
      density: 100,
      kind: "fire",
      frames: [
        {
          asset: "a".repeat(24),
          x: 0,
          y: 0,
          width: 32,
          height: 32,
          pageWidth: 32,
          pageHeight: 32,
        },
      ],
    },
  ];
  const all = new Map([[chunkKey(c), c]]),
    tex = new THREE.Texture(),
    effects = new FlowSprites(tex, () => [0, 0, 1, 1]);
  try {
    effects.update([c]);
    effects.frame(new THREE.PerspectiveCamera(), all, 100, 4, 2);
    expect(effects.visibleCount).toBe(1);
    const fire = effects.group.children[1] as THREE.Mesh;
    expect(fire.geometry.drawRange.count).toBeGreaterThan(0);
    const before = fire.geometry.getAttribute("position").array.slice();
    effects.frame(new THREE.PerspectiveCamera(), all, 250, 4, 2);
    expect(fire.geometry.getAttribute("position").array).not.toEqual(before);
    c.flows = [];
    effects.update([c]);
    effects.frame(new THREE.PerspectiveCamera(), all, 500, 4, 2);
    expect(fire.geometry.drawRange.count).toBe(0);
  } finally {
    effects.dispose();
    tex.dispose();
  }
});
it("rejects hidden flows over the browser boundary", () => {
  const c = block();
  c.tiles[0].shape = "unknown";
  c.flows = [{ x: 0, y: 0, z: 4, kind: "mist", density: 50 }];
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "a",
      sequence: 1,
      pollMs: 1,
      chunks: [c],
    }),
  ).toThrow(/Hidden flow/);
});
