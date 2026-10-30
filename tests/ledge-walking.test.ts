import { it, expect, vi } from "vitest";
import * as THREE from "three";
import {
  FirstPersonControls,
  canStepOff,
  fallDestination,
} from "../src/viewer/first-person.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";

const block = (z: number, shape: Chunk["tiles"][number]["shape"]): Chunk => ({
  x: 0,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape,
    material: 2,
    name: "Terrain",
  })),
});
function ledge(level = 5) {
  const top = block(level, "floor"),
    roof = block(level + 1, "empty");
  top.tiles.forEach((t, i) => {
    if (i % 16 >= 5) t.shape = "empty";
  });
  return new Map([top, roof].map((c) => [chunkKey(c), c]));
}
it("permits stepping into loaded air while retaining wall, unknown, boundary and headroom collisions", () => {
  const chunks = ledge();
  expect(canStepOff(chunks, 4.95, 4.5, 5, 5.12)).toBe(true);
  expect(canStepOff(chunks, 5.3, 4.5, 5, 5.12)).toBe(true);
  expect(canStepOff(chunks, 15.95, 4.5, 5, 5.12)).toBe(false);
  const target = chunks.get("0,0,5")!.tiles[4 * 16 + 5];
  for (const shape of ["wall", "unknown"] as const) {
    target.shape = shape;
    expect(canStepOff(chunks, 5.3, 4.5, 5, 5.12)).toBe(false);
  }
  target.shape = "empty";
  chunks.delete("0,0,6");
  expect(canStepOff(chunks, 5.3, 4.5, 5, 5.12)).toBe(false);
});
it("finds lower landings and bounds deep falls to known air without crossing hidden terrain", () => {
  const chunks = ledge(12);
  for (let z = 11; z >= 7; z--) {
    const c = block(z, "empty");
    chunks.set(chunkKey(c), c);
  }
  expect(fallDestination(chunks, 5.5, 4.5, 12)).toEqual({
    level: 7,
    height: 7.12,
  });
  chunks.get("0,0,10")!.tiles[4 * 16 + 5].shape = "unknown";
  expect(fallDestination(chunks, 5.5, 4.5, 12)).toEqual({
    level: 11,
    height: 11.12,
  });
  chunks.get("0,0,11")!.tiles[4 * 16 + 5].shape = "unknown";
  expect(fallDestination(chunks, 5.5, 4.5, 12)).toBeUndefined();
});
async function walkOff(level: number, stream: boolean) {
  const win = new EventTarget(),
    doc = Object.assign(new EventTarget(), {
      activeElement: null as unknown,
      pointerLockElement: null,
      exitPointerLock: () => {},
    });
  class Canvas extends EventTarget {
    focus() {
      doc.activeElement = this;
    }
    requestPointerLock() {
      return Promise.reject(Error("No capture"));
    }
  }
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  const chunks = ledge(level),
    camera = new THREE.PerspectiveCamera();
  const landing = stream ? 2 : 3;
  for (let z = level - 1; z >= Math.max(landing, level - 5); z--) {
    const c = block(z, z === landing ? "floor" : "empty");
    chunks.set(chunkKey(c), c);
  }
  const controls = new FirstPersonControls(
    new Canvas() as unknown as HTMLCanvasElement,
    camera,
    () => chunks,
  );
  const changes: number[] = [];
  controls.onLevelChange = (z) => {
    changes.push(z);
    if (stream && z === level - 5)
      for (let n = z - 1; n >= landing; n--) {
        const c = block(n, n === landing ? "floor" : "empty");
        chunks.set(chunkKey(c), c);
      }
  };
  try {
    controls.enter(4.5, 4.5, level);
    await Promise.resolve();
    win.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), {
        code: "KeyD",
      }),
    );
    for (let i = 0; i < 8; i++) controls.update(0.05);
    win.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyD" }));
    expect(camera.position.x).toBeGreaterThan(5.18);
    let previous = camera.position.y;
    for (let i = 0; i < 80; i++) {
      controls.update(0.05);
      expect(camera.position.y).toBeLessThanOrEqual(previous + 1e-8);
      previous = camera.position.y;
    }
    expect(camera.position.y).toBeCloseTo(landing + 0.76);
    expect(changes).toEqual(stream ? [7, 2] : [3]);
  } finally {
    controls.dispose();
    vi.unstubAllGlobals();
  }
}
it("walks off a two-level ledge and lands without a ramp or stair shortcut", async () =>
  walkOff(5, false));
it("continues deep falls as the next vertical terrain window streams in", async () =>
  walkOff(12, true));
