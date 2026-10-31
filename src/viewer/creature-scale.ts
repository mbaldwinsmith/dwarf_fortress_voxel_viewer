import { tileAt, type Chunk } from "../shared/model.js";

/** Compress raw body volumes around an adult dwarf (60,000). Native artwork
 * retains its aspect ratio and proportions; equipment uses the same factor.
 * log1p handles tiny creatures without a negative or zero display size. */
export function creatureScale(bodySize?: number): number {
  if (bodySize === undefined || !Number.isFinite(bodySize) || bodySize <= 0)
    return 1;
  return Math.max(
    0.35,
    Math.min(3, Math.log1p(bodySize / 6000) / Math.log1p(10)),
  );
}

/** Test actual terrain above the feet, independently of the camera's cutaway.
 * Stairs stay open; floors, ramp undersides and opaque rock form ceilings.
 * Unloaded cells provide no evidence of a ceiling. */
export function creatureCeilingFit(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  ground: number,
  height: number,
): number {
  if (!(height > 0)) return 1;
  for (
    let z = Math.floor(ground) + 1;
    z <= Math.ceil(ground + height + 0.025);
    z++
  ) {
    const t = tileAt(chunks, x, y, z);
    if (
      t &&
      (t.shape === "floor" ||
        t.shape === "ramp" ||
        t.shape === "unknown" ||
        (t.shape === "wall" && !t.treeGraphic))
    )
      return Math.max(0.01, Math.min(1, (z - ground - 0.025) / height));
  }
  return 1;
}

/** Enforce new headroom immediately so no frame intersects rock; ease growth
 * back toward the natural size, independent of frame rate or snapshot frequency. */
export function smoothCreatureFit(
  current: number,
  target: number,
  seconds: number,
) {
  if (target <= current) return target;
  const next =
    target +
    (current - target) * Math.exp(-6 * Math.max(0, Math.min(0.25, seconds)));
  return target - next < 0.001 ? target : next;
}
