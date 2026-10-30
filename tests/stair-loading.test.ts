import { it, expect, vi } from "vitest";
import * as THREE from "three";
import { FirstPersonControls } from "../src/viewer/first-person.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
it("waits on unloaded stairs instead of moving sideways, then descends when data arrives", async () => {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    activeElement: null as unknown,
    pointerLockElement: null,
    exitPointerLock: () => {},
  });
  class Canvas extends EventTarget {
    tabIndex = 0;
    focus() {
      doc.activeElement = this;
    }
    requestPointerLock() {
      return Promise.reject(Error("Embedded browser denies capture"));
    }
  }
  const canvas = new Canvas(),
    camera = new THREE.PerspectiveCamera();
  const block = (z: number): Chunk => ({
    x: 0,
    y: 0,
    z,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "floor",
      material: 2,
      name: "Floor",
    })),
  });
  const current = block(4),
    roof = block(5);
  roof.tiles.forEach((t) => (t.shape = "empty"));
  current.tiles[68] = { shape: "stairs", material: 2, name: "Down stair" };
  const chunks = new Map([current, roof].map((c) => [chunkKey(c), c]));
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  const controls = new FirstPersonControls(
    canvas as unknown as HTMLCanvasElement,
    camera,
    () => chunks,
  );
  try {
    controls.enter(4.5, 4.5, 4);
    await Promise.resolve();
    expect(controls.active).toBe(true);
    expect(controls.locked).toBe(false);
    const initial = camera.position.toArray();
    win.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), {
        code: "Period",
        shiftKey: true,
      }),
    );
    controls.update(0.05);
    expect(camera.position.toArray()).toEqual(initial);
    const lower = block(3);
    lower.tiles[68] = { shape: "stairs", material: 2, name: "Up stair" };
    chunks.set(chunkKey(lower), lower);
    const changed: number[] = [];
    controls.onLevelChange = (z) => changed.push(z);
    for (let i = 0; i < 11; i++) controls.update(0.05);
    expect(changed).toEqual([3]);
    expect(camera.position.y).toBeCloseTo(3.76);
    chunks.delete(chunkKey(roof));
    win.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), {
        code: "Comma",
        shiftKey: true,
      }),
    );
    for (let i = 0; i < 11; i++) controls.update(0.05);
    // Landing is loaded, but headroom is still streaming. One keypress waits
    // for both instead of being discarded before the next column arrives.
    expect(changed).toEqual([3]);
    chunks.set(chunkKey(roof), roof);
    for (let i = 0; i < 11; i++) controls.update(0.05);
    expect(changed).toEqual([3, 4]);
    expect(camera.position.y).toBeCloseTo(4.76);
    // S now walks backwards on stairs, without triggering another descent.
    win.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), {
        code: "KeyS",
      }),
    );
    controls.update(0.05);
    expect(changed).toEqual([3, 4]);
    expect(camera.position.y).toBeCloseTo(4.76);
    win.dispatchEvent(Object.assign(new Event("keydown"), { code: "Escape" }));
    expect(controls.active).toBe(false);
  } finally {
    controls.dispose();
    vi.unstubAllGlobals();
  }
});
