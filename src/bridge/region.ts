import type { Bounds } from "../shared/model.js";
export class ScreenElevation {
  private native?: number;
  private manual?: number;
  select(level: number) {
    this.manual = level;
  }
  follow(native: number) {
    if (this.native !== undefined && native !== this.native)
      this.manual = undefined;
    this.native = native;
    return this.manual ?? native;
  }
  reset() {
    this.native = undefined;
    this.manual = undefined;
  }
}
export function parseMode(message: string): "screen" | "map" | undefined {
  try {
    const m = JSON.parse(message);
    if (m?.type === "mode" && (m.mode === "screen" || m.mode === "map"))
      return m.mode;
  } catch {
    /* Invalid operations are rejected by the caller. */
  }
}
export function screenRegion(map: Bounds, view: Record<string, unknown>) {
  const read = (k: string) => {
    const n = view[k];
    if (typeof n !== "number" || !Number.isInteger(n))
      throw Error(`Invalid viewport ${k}`);
    return n;
  };
  const x = Math.max(map.x, Math.min(map.x + map.width - 1, read("viewPosX"))),
    y = Math.max(map.y, Math.min(map.y + map.depth - 1, read("viewPosY")));
  const width = read("viewSizeX"),
    depth = read("viewSizeY");
  if (width < 1 || depth < 1) throw Error("DFHack returned an empty viewport");
  const bx = Math.floor(x / 16) * 16,
    by = Math.floor(y / 16) * 16;
  return {
    bounds: {
      ...map,
      x: bx,
      y: by,
      width: Math.min(map.x + map.width, Math.ceil((x + width) / 16) * 16) - bx,
      depth: Math.min(map.y + map.depth, Math.ceil((y + depth) / 16) * 16) - by,
    },
    level: Math.max(map.z, Math.min(map.z + map.height - 1, read("viewPosZ"))),
  };
}
export function parseLevel(
  message: string,
  bounds: Bounds | undefined,
): number | undefined {
  try {
    const m: unknown = JSON.parse(message);
    if (
      !bounds ||
      typeof m !== "object" ||
      !m ||
      !("type" in m) ||
      m.type !== "level" ||
      !("z" in m) ||
      typeof m.z !== "number" ||
      !Number.isInteger(m.z) ||
      m.z < bounds.z ||
      m.z >= bounds.z + bounds.height
    )
      return;
    return m.z;
  } catch {
    return;
  }
}
export function blockOrder(
  b: Bounds,
  level: number,
  focus?: { x: number; y: number },
  canopy = false,
): [number, number, number][] {
  const levels = [level, level + 1, level + 2, level - 1, level - 2].filter(
    (z) => z >= b.z && z < b.z + b.height,
  );
  if (Math.ceil(b.width / 16) * Math.ceil(b.depth / 16) * levels.length > 4096)
    throw Error("Map footprint exceeds the current 4096-block resident limit");
  const xy: [number, number][] = [];
  for (let y = b.y; y < b.y + b.depth; y += 16)
    for (let x = b.x; x < b.x + b.width; x += 16) xy.push([x, y]);
  // Useful terrain appears first instead of streaming a corner of empty sky.
  const distance = ([x, y]: number[]) =>
    Math.abs(x + 8 - (focus?.x ?? b.x + b.width / 2)) +
    Math.abs(y + 8 - (focus?.y ?? b.y + b.depth / 2));
  xy.sort((a, b) => distance(a) - distance(b));
  const order: [number, number, number][] = [];
  // Complete the nearby column in both directions before expanding outward.
  // Returning down stairs must not wait for a map-wide overhead sweep.
  for (const [x, y] of xy) {
    for (const z of levels) order.push([x, y, z]);
    if (
      canopy &&
      focus &&
      Math.abs(x / 16 - Math.floor(focus.x / 16)) <= 2 &&
      Math.abs(y / 16 - Math.floor(focus.y / 16)) <= 2
    )
      for (
        let z = level + 3;
        z <= Math.min(level + 12, b.z + b.height - 1);
        z++
      )
        order.push([x, y, z]);
  }
  if (order.length > 4096)
    throw Error("Map footprint exceeds the current 4096-block resident limit");
  return order;
}
