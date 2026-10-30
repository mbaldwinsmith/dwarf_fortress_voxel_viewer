import { LEVELS_ABOVE, LEVELS_BELOW, type Bounds } from "../shared/model.js";
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
): [number, number, number][] {
  const offsets = [0];
  for (let i = 1; i <= Math.max(LEVELS_ABOVE, LEVELS_BELOW); i++) {
    if (i <= LEVELS_ABOVE) offsets.push(i);
    if (i <= LEVELS_BELOW) offsets.push(-i);
  }
  const levels = offsets
    .map((offset) => level + offset)
    .filter((z) => z >= b.z && z < b.z + b.height);
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
  // Load walking terrain in the surrounding 3x3 columns before distant sky.
  const near = xy.filter(
    ([x, y]) => Math.abs(x - xy[0][0]) <= 16 && Math.abs(y - xy[0][1]) <= 16,
  );
  for (const [x, y] of near)
    for (const z of levels.filter((z) => Math.abs(z - level) <= 2))
      order.push([x, y, z]);
  for (const [x, y] of xy) {
    for (const z of levels)
      if (
        !near.some(([nx, ny]) => nx === x && ny === y) ||
        Math.abs(z - level) > 2
      )
        order.push([x, y, z]);
  }
  if (order.length > 4096)
    throw Error("Map footprint exceeds the current 4096-block resident limit");
  return order;
}

export function columnBatches(order: [number, number, number][]) {
  const batches: { x: number; y: number; levels: number[] }[] = [];
  for (const [x, y, z] of order) {
    const previous = batches.at(-1);
    if (previous && previous.x === x && previous.y === y)
      previous.levels.push(z);
    else batches.push({ x, y, levels: [z] });
  }
  return batches;
}
