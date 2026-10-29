import { tileAt, type Chunk } from "../shared/model.js";
import { rampHeight } from "./ramps.js";
export function surfaceHeight(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  const t = tileAt(chunks, Math.floor(x), Math.floor(y), z);
  if (!t || !["floor", "stairs", "ramp"].includes(t.shape)) return;
  return z + (t.shape === "ramp" ? rampHeight(chunks, x, y, z) : 0.12);
}
export function stairDestination(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
  direction: number,
) {
  const from = tileAt(chunks, Math.floor(x), Math.floor(y), z),
    to = tileAt(chunks, Math.floor(x), Math.floor(y), z + direction);
  const supports = (name: string, up: boolean) =>
    up ? /up/i.test(name) : /down/i.test(name);
  if (
    from?.shape === "stairs" &&
    to?.shape === "stairs" &&
    supports(from.name, direction > 0) &&
    supports(to.name, direction < 0)
  )
    return z + direction;
}
export function rampDestination(
  chunks: Map<string, Chunk>,
  fromX: number,
  fromY: number,
  x: number,
  y: number,
  z: number,
) {
  const source = tileAt(chunks, Math.floor(fromX), Math.floor(fromY), z);
  const oldHeight = surfaceHeight(chunks, fromX, fromY, z);
  if (oldHeight === undefined) return;
  for (const level of [z, z + 1, z - 1]) {
    const target = tileAt(chunks, Math.floor(x), Math.floor(y), level);
    const h = surfaceHeight(chunks, x, y, level);
    if (h === undefined || Math.abs(h - oldHeight) > 0.32) continue;
    if (level !== z && source?.shape !== "ramp" && target?.shape !== "ramp")
      continue;
    return level;
  }
}
