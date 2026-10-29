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
