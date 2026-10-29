import type { Bounds } from "../shared/model.js";
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
): [number, number, number][] {
  if (Math.ceil(b.width / 16) * Math.ceil(b.depth / 16) * 3 > 4096)
    throw Error("Map footprint exceeds the current 4096-block resident limit");
  const xy: [number, number][] = [];
  for (let y = b.y; y < b.y + b.depth; y += 16)
    for (let x = b.x; x < b.x + b.width; x += 16) xy.push([x, y]);
  // Useful terrain appears first instead of streaming a corner of empty sky.
  const distance = ([x, y]: number[]) =>
    Math.abs(x + 8 - b.x - b.width / 2) + Math.abs(y + 8 - b.y - b.depth / 2);
  xy.sort((a, b) => distance(a) - distance(b));
  const order: [number, number, number][] = [];
  for (let z = level; z >= Math.max(b.z, level - 2); z--)
    for (const [x, y] of xy) order.push([x, y, z]);
  return order;
}
