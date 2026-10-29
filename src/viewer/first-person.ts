import * as THREE from "three";
import { tileAt, type Chunk } from "../shared/model.js";
import {
  surfaceHeight,
  stairDestination,
  rampDestination,
} from "./traversal.js";

export const EYE_HEIGHT = 0.64;
const RADIUS = 0.18;
export function walkingHeight(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  return surfaceHeight(chunks, x, y, z);
}
export function canWalk(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
  mapTop = Infinity,
) {
  const centerHeight = walkingHeight(chunks, x, y, z);
  if (centerHeight === undefined) return false;
  const centerRamp =
    tileAt(chunks, Math.floor(x), Math.floor(y), z)?.shape === "ramp";
  for (const dx of [-RADIUS, 0, RADIUS])
    for (const dy of [-RADIUS, 0, RADIUS]) {
      let support = z,
        h = walkingHeight(chunks, x + dx, y + dy, z);
      if (h === undefined || Math.abs(h - centerHeight) > 0.4) {
        for (const alt of [z + 1, z - 1]) {
          const t = tileAt(chunks, Math.floor(x + dx), Math.floor(y + dy), alt),
            candidate = walkingHeight(chunks, x + dx, y + dy, alt);
          if (
            candidate !== undefined &&
            Math.abs(candidate - centerHeight) <= 0.4 &&
            (centerRamp || t?.shape === "ramp")
          ) {
            support = alt;
            h = candidate;
            break;
          }
        }
      }
      const above = tileAt(
        chunks,
        Math.floor(x + dx),
        Math.floor(y + dy),
        support + 1,
      );
      if (
        h === undefined ||
        Math.abs(h - centerHeight) > 0.4 ||
        (!above && support !== mapTop)
      )
        return false;
      if (
        above &&
        !["empty", "stairs"].includes(above.shape) &&
        h + EYE_HEIGHT + 0.08 >= support + 1
      )
        return false;
    }
  return true;
}

export class FirstPersonControls {
  enabled = false;
  waitingForTerrain = false;
  onLevelChange?: (level: number) => void;
  onCaptureChange?: (message: string) => void;
  private focused = false;
  private hadLock = false;
  private pointer?: { x: number; y: number };
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private level = 0;
  private climbing?: { from: number; to: number; progress: number };
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private chunks: () => Map<string, Chunk>,
    private mapTop: () => number = () => Infinity,
  ) {
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.pause);
    document.addEventListener("mousemove", this.look);
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener("blur", this.pause);
    this.canvas.addEventListener("mouseleave", this.resetPointer);
    document.addEventListener("pointerlockchange", this.lockChanged);
  }
  get active() {
    return (
      this.enabled &&
      (this.locked || (this.focused && document.activeElement === this.canvas))
    );
  }
  get locked() {
    return document.pointerLockElement === this.canvas;
  }
  enter(x: number, y: number, z: number) {
    this.enabled = true;
    this.waitingForTerrain = false;
    this.level = z;
    this.climbing = undefined;
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
    if (!this.enabled) return;
    this.canvas.focus({ preventScroll: true });
    this.pointer = undefined;
    this.focused = true;
    this.onCaptureChange?.(
      "Controls active · WASD to walk · Mouse over the view to look · Esc pauses",
    );
    if (this.locked) return;
    // Pointer lock is requested only in a genuine viewport click gesture.
    try {
      const pending = this.canvas.requestPointerLock();
      pending?.catch(() =>
        this.onCaptureChange?.(
          "Controls active · Mouse capture unavailable here; keep the pointer over the view to look · WASD to walk · Esc pauses",
        ),
      );
    } catch {
      this.onCaptureChange?.(
        "Controls active · Keep the pointer over the view to look · WASD to walk · Esc pauses",
      );
    }
  }
  exit() {
    this.enabled = false;
    this.waitingForTerrain = false;
    this.climbing = undefined;
    this.focused = false;
    this.clear();
    if (this.locked) document.exitPointerLock();
  }
  private clear = () => {
    this.keys.clear();
  };
  private pause = () => {
    this.focused = false;
    this.clear();
    this.onCaptureChange?.(
      "Paused · Click the view to enable WASD and mouse look",
    );
  };
  private lockChanged = () => {
    if (this.hadLock && !this.locked) this.pause();
    this.hadLock = this.locked;
    this.clear();
  };
  private keydown = (e: KeyboardEvent) => {
    if (this.enabled && e.code === "Escape") {
      if (this.locked) document.exitPointerLock();
      this.pause();
      return;
    }
    if (
      !this.enabled ||
      !this.active ||
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
    if (!this.active || (!this.locked && e.target !== this.canvas)) return;
    let dx = e.movementX,
      dy = e.movementY;
    if (!this.locked) {
      const previous = this.pointer;
      this.pointer = { x: e.clientX, y: e.clientY };
      if (!previous) return;
      dx = e.clientX - previous.x;
      dy = e.clientY - previous.y;
    }
    this.yaw -= dx * 0.0025;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * 0.0025,
      -Math.PI / 2 + 0.03,
      Math.PI / 2 - 0.03,
    );
    this.rotate();
  };
  private resetPointer = () => {
    this.pointer = undefined;
  };
  private rotate() {
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"),
    );
  }
  update(dt: number) {
    if (!this.active || this.waitingForTerrain) return;
    const forward =
      Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const right = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const length = Math.hypot(forward, right);
    const p = this.camera.position,
      chunks = this.chunks();
    if (!this.climbing && forward && !right) {
      const destination = stairDestination(
        chunks,
        p.x,
        p.z,
        this.level,
        Math.sign(forward),
      );
      if (
        destination !== undefined &&
        canWalk(
          chunks,
          Math.floor(p.x) + 0.5,
          Math.floor(p.z) + 0.5,
          destination,
          this.mapTop(),
        )
      ) {
        p.x = Math.floor(p.x) + 0.5;
        p.z = Math.floor(p.z) + 0.5;
        this.climbing = { from: this.level, to: destination, progress: 0 };
      }
    }
    if (this.climbing) {
      const c = this.climbing;
      c.progress = Math.min(1, c.progress + Math.min(dt, 0.05) / 0.5);
      p.y = THREE.MathUtils.lerp(c.from, c.to, c.progress) + 0.12 + EYE_HEIGHT;
      if (c.progress === 1) {
        this.level = c.to;
        this.climbing = undefined;
        this.onLevelChange?.(this.level);
      }
      return;
    }
    if (!length) return;
    const distance = (2.5 * Math.min(dt, 0.05)) / length;
    const dx =
      (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * distance;
    const dy =
      (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * distance;
    // Small steps and separate axes allow sliding alongside walls.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.08));
    for (let i = 0; i < steps; i++) {
      for (const [sx, sy] of [
        [dx / steps, 0],
        [0, dy / steps],
      ]) {
        const z = rampDestination(
          chunks,
          p.x,
          p.z,
          p.x + sx,
          p.z + sy,
          this.level,
        );
        if (
          z !== undefined &&
          canWalk(chunks, p.x + sx, p.z + sy, z, this.mapTop())
        ) {
          p.x += sx;
          p.z += sy;
          if (z !== this.level) {
            this.level = z;
            this.onLevelChange?.(z);
          }
        }
      }
    }
    const height = walkingHeight(chunks, p.x, p.z, this.level);
    if (height !== undefined) p.y = height + EYE_HEIGHT;
  }
  dispose() {
    this.exit();
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.pause);
    document.removeEventListener("mousemove", this.look);
    document.removeEventListener("pointerlockchange", this.lockChanged);
    this.canvas.removeEventListener("blur", this.pause);
    this.canvas.removeEventListener("mouseleave", this.resetPointer);
  }
}
