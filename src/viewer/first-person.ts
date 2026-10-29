import * as THREE from "three";
import { tileAt, type Chunk } from "../shared/model.js";
import { rampSurface } from "./ramps.js";

export const EYE_HEIGHT = 0.64;
const RADIUS = 0.18;
export function walkingHeight(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  const t = tileAt(chunks, Math.floor(x), Math.floor(y), z);
  if (!t || !["floor", "ramp", "stairs"].includes(t.shape)) return;
  return (
    z +
    (t.shape === "ramp"
      ? rampSurface(chunks, Math.floor(x), Math.floor(y), z).center
      : 0.12)
  );
}
export function canWalk(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
  mapTop = Infinity,
) {
  // Circle approximation prevents clipping through walls, unknown terrain or
  // unloaded block boundaries. Stay on the chosen Z-level for this walk mode.
  for (const dx of [-RADIUS, 0, RADIUS])
    for (const dy of [-RADIUS, 0, RADIUS]) {
      const h = walkingHeight(chunks, x + dx, y + dy, z);
      const above = tileAt(
        chunks,
        Math.floor(x + dx),
        Math.floor(y + dy),
        z + 1,
      );
      if (h === undefined || (!above && z !== mapTop)) return false;
      if (above && above.shape !== "empty" && h + EYE_HEIGHT + 0.08 >= z + 1)
        return false;
    }
  return true;
}

export class FirstPersonControls {
  enabled = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private level = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private chunks: () => Map<string, Chunk>,
    private mapTop: () => number = () => Infinity,
  ) {
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.clear);
    document.addEventListener("mousemove", this.look);
    document.addEventListener("pointerlockchange", this.clear);
  }
  get locked() {
    return document.pointerLockElement === this.canvas;
  }
  enter(x: number, y: number, z: number) {
    this.enabled = true;
    this.level = z;
    this.camera.position.set(
      x,
      walkingHeight(this.chunks(), x, y, z)! + EYE_HEIGHT,
      y,
    );
    this.yaw = 0;
    this.pitch = 0;
    this.rotate();
    this.capture();
  }
  capture() {
    if (!this.enabled || this.locked) return;
    // Pointer lock is requested only in a genuine viewport click gesture.
    try {
      const pending = this.canvas.requestPointerLock();
      pending?.catch(() => {});
    } catch {
      /* Click again to retry when the browser permits capture. */
    }
  }
  exit() {
    this.enabled = false;
    this.clear();
    if (this.locked) document.exitPointerLock();
  }
  private clear = () => {
    this.keys.clear();
  };
  private keydown = (e: KeyboardEvent) => {
    if (this.enabled && this.locked && e.code === "Escape") {
      document.exitPointerLock();
      this.clear();
      return;
    }
    if (
      !this.enabled ||
      !this.locked ||
      !["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)
    )
      return;
    e.preventDefault();
    this.keys.add(e.code);
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private look = (e: MouseEvent) => {
    if (!this.enabled || !this.locked) return;
    this.yaw -= e.movementX * 0.0025;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - e.movementY * 0.0025,
      -Math.PI / 2 + 0.03,
      Math.PI / 2 - 0.03,
    );
    this.rotate();
  };
  private rotate() {
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"),
    );
  }
  update(dt: number) {
    if (!this.enabled || !this.locked) return;
    const forward =
      Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const right = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const length = Math.hypot(forward, right);
    if (!length) return;
    const distance = (2.5 * Math.min(dt, 0.05)) / length;
    const dx =
      (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * distance;
    const dy =
      (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * distance;
    const p = this.camera.position,
      chunks = this.chunks();
    // Small steps and separate axes allow sliding alongside walls.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.08));
    for (let i = 0; i < steps; i++) {
      if (canWalk(chunks, p.x + dx / steps, p.z, this.level, this.mapTop()))
        p.x += dx / steps;
      if (canWalk(chunks, p.x, p.z + dy / steps, this.level, this.mapTop()))
        p.z += dy / steps;
    }
    const height = walkingHeight(chunks, p.x, p.z, this.level);
    if (height !== undefined) p.y = height + EYE_HEIGHT;
  }
  dispose() {
    this.exit();
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("mousemove", this.look);
    document.removeEventListener("pointerlockchange", this.clear);
  }
}
