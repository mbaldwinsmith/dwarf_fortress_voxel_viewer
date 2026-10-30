import { it, expect, vi } from "vitest";
import * as THREE from "three";
import { OrbitKeyboard } from "../src/viewer/orbit-keyboard.js";

it("pans relative to the camera on the map plane, normalizes diagonals and rotates around a fixed target", () => {
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  const camera = new THREE.PerspectiveCamera(),
    target = new THREE.Vector3();
  camera.position.set(0, 10, 10);
  camera.lookAt(target);
  const control = new OrbitKeyboard(camera, target, () => true);
  const key = (type: string, code: string) =>
    win.dispatchEvent(
      Object.assign(new Event(type, { cancelable: true }), { code }),
    );
  try {
    key("keydown", "KeyW");
    control.update(0.05);
    key("keyup", "KeyW");
    const distance = target.length();
    expect(target.z).toBeLessThan(0);
    expect(target.y).toBe(0);
    expect(camera.position.y).toBe(10);
    camera.position.set(0, 10, 10);
    target.set(0, 0, 0);
    camera.lookAt(target);
    key("keydown", "KeyW");
    key("keydown", "KeyD");
    control.update(0.05);
    win.dispatchEvent(new Event("blur"));
    expect(target.length()).toBeCloseTo(distance);
    expect(target.x).toBeGreaterThan(0);
    expect(target.z).toBeLessThan(0);
    const pivot = target.clone(),
      position = camera.position.clone(),
      radius = camera.position.distanceTo(target);
    key("keydown", "KeyQ");
    control.update(0.05);
    key("keyup", "KeyQ");
    expect(target.equals(pivot)).toBe(true);
    expect(camera.position.distanceTo(target)).toBeCloseTo(radius);
    expect(camera.position.y).toBe(10);
    expect(camera.position.distanceTo(position)).toBeGreaterThan(0);
    key("keydown", "KeyE");
    control.update(0.05);
    key("keyup", "KeyE");
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
  } finally {
    control.dispose();
    vi.unstubAllGlobals();
  }
});
it("ignores form editing and command chords and clears held keys when Orbit is disabled or focus is lost", () => {
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  let enabled = true;
  const camera = new THREE.PerspectiveCamera(),
    target = new THREE.Vector3();
  camera.position.set(0, 10, 10);
  camera.lookAt(target);
  const control = new OrbitKeyboard(camera, target, () => enabled);
  const press = (fields: object, target?: object) => {
    const e = Object.assign(
      new Event("keydown", { cancelable: true }),
      { code: "KeyW" },
      fields,
    );
    if (target) Object.defineProperty(e, "target", { value: target });
    win.dispatchEvent(e);
  };
  try {
    press({ ctrlKey: true });
    press({}, { tagName: "SELECT" });
    press({}, { isContentEditable: true });
    control.update(0.05);
    expect(target.length()).toBe(0);
    press({});
    enabled = false;
    control.update(0.05);
    enabled = true;
    control.update(0.05);
    expect(target.length()).toBe(0);
    press({});
    win.dispatchEvent(new Event("blur"));
    control.update(0.05);
    expect(target.length()).toBe(0);
    control.dispose();
    press({});
    control.update(0.05);
    expect(target.length()).toBe(0);
  } finally {
    control.dispose();
    vi.unstubAllGlobals();
  }
});
