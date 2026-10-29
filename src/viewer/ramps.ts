import { tileAt, type Chunk } from "../shared/model.js";

// DF ramps have no intrinsic uphill heading. Shape a height field against the
// surrounding walls. Unknown tiles use only their redacted opaque shape.
// Order: NW, SW, SE, NE; positive map Y is south.
export function rampSurface(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
) {
  const wall = (dx: number, dy: number) => {
    const shape = tileAt(chunks, x + dx, y + dy, z)?.shape;
    return shape === "wall" || shape === "unknown";
  };
  const corners = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ].map(([dx, dy]) => (wall(dx, 0) || wall(0, dy) || wall(dx, dy) ? 1 : 0.12));
  // Multiple uphill exits form a shallow basin rather than arbitrarily choosing
  // one direction or filling the entire tile to wall height.
  const center = Math.min(0.56, corners.reduce((sum, h) => sum + h, 0) / 4);
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
