import { tileAt, type Chunk } from "../shared/model.js";
export const FLOOR_HEIGHT = 0.12;
export const RAMP_HIGH = 1 + FLOOR_HEIGHT;

// DF ramps have no intrinsic uphill heading. Shape a height field against the
// surrounding walls. Unknown tiles use only their redacted opaque shape.
// Order: NW, SW, SE, NE; positive map Y is south.
export function rampSurface(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  const exits = new Set<string>();
  for (const dx of [-1, 0, 1])
    for (const dy of [-1, 0, 1]) {
      if (!dx && !dy) continue;
      const base = tileAt(chunks, x + dx, y + dy, z),
        top = tileAt(chunks, x + dx, y + dy, z + 1);
      if (
        base?.shape === "wall" &&
        top &&
        ["floor", "stairs", "ramp"].includes(top.shape)
      )
        exits.add(`${dx},${dy}`);
    }
  const wall = (dx: number, dy: number) => {
    if (exits.size) return exits.has(`${dx},${dy}`);
    const shape = tileAt(chunks, x + dx, y + dy, z)?.shape;
    return shape === "wall" || shape === "unknown";
  };
  const cardinalUphill = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].some(([dx, dy]) => wall(dx, dy));
  const corners = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ].map(([dx, dy]) => {
    const lowExit = [
      [dx, 0],
      [0, dy],
    ].some(([ox, oy]) => {
      const shape = tileAt(chunks, x + ox, y + oy, z)?.shape;
      return shape === "floor" || shape === "stairs";
    });
    // Along a cardinal slope, a diagonal hill must not raise its downhill exit.
    // Preserve diagonal-only ramps, which have no cardinal uphill alternative.
    return wall(dx, 0) ||
      wall(0, dy) ||
      (wall(dx, dy) && (!lowExit || !cardinalUphill))
      ? RAMP_HIGH
      : FLOOR_HEIGHT;
  });
  // Multiple uphill exits form a shallow basin rather than arbitrarily choosing
  // one direction or filling the entire tile to wall height.
  const center = Math.min(
    (RAMP_HIGH + FLOOR_HEIGHT) / 2,
    corners.reduce((sum, h) => sum + h, 0) / 4,
  );
  return { corners, center };
}

// Sample the same four triangles used by the terrain mesh.
export function rampHeight(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  const { corners, center } = rampSurface(
    chunks,
    Math.floor(x),
    Math.floor(y),
    z,
  );
  const u = x - Math.floor(x),
    v = y - Math.floor(y);
  const points = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = points[i],
      [bx, by] = points[(i + 1) % 4];
    const det = (by - 0.5) * (ax - 0.5) + (0.5 - bx) * (ay - 0.5);
    const a = ((by - 0.5) * (u - 0.5) + (0.5 - bx) * (v - 0.5)) / det;
    const b = ((0.5 - ay) * (u - 0.5) + (ax - 0.5) * (v - 0.5)) / det;
    if (a >= -1e-8 && b >= -1e-8 && a + b <= 1 + 1e-8)
      return a * corners[i] + b * corners[(i + 1) % 4] + (1 - a - b) * center;
  }
  return center;
}
