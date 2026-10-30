import type { TreeBox } from "./trees.js";
type Rect = [number, number, number, number];
export interface BoxFace {
  box: number;
  vertices: number[][];
  crop: Rect;
}
const EPS = 1e-9;
function subtract(a: Rect, b: Rect): Rect[] {
  const l = Math.max(a[0], b[0]),
    r = Math.min(a[2], b[2]),
    bottom = Math.max(a[1], b[1]),
    top = Math.min(a[3], b[3]);
  if (r - l <= EPS || top - bottom <= EPS) return [a];
  return [
    [a[0], a[1], l, a[3]],
    [r, a[1], a[2], a[3]],
    [l, a[1], r, bottom],
    [l, top, r, a[3]],
  ].filter((p) => p[2] - p[0] > EPS && p[3] - p[1] > EPS) as Rect[];
}
// Surface of a union of boxes: subtract hidden and coplanar overlaps rather than
// drawing competing polygons and relying on depth offsets to hide the flicker.
export function exposedBoxFaces(boxes: TreeBox[]): BoxFace[] {
  const bounds = boxes.map((b) => [
    [b.x, b.y, b.z],
    [b.x + b.w, b.y + b.h, b.z + b.d],
  ]);
  const result: BoxFace[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const [[x, l, z], [r, u, b]] = bounds[i];
    const faces = [
      [
        [r, l, z],
        [r, u, z],
        [r, u, b],
        [r, l, b],
      ],
      [
        [x, l, b],
        [x, u, b],
        [x, u, z],
        [x, l, z],
      ],
      [
        [r, l, b],
        [r, u, b],
        [x, u, b],
        [x, l, b],
      ],
      [
        [x, l, z],
        [x, u, z],
        [r, u, z],
        [r, l, z],
      ],
      [
        [x, u, b],
        [r, u, b],
        [r, u, z],
        [x, u, z],
      ],
      [
        [x, l, z],
        [r, l, z],
        [r, l, b],
        [x, l, b],
      ],
    ];
    for (const [face, vertices] of faces.entries()) {
      const axis = [0, 0, 2, 2, 1, 1][face],
        positive = face % 2 === 0;
      const plane = vertices[0][axis];
      const sAxis = vertices[0].findIndex((v, k) => v !== vertices[1][k]);
      const tAxis = vertices[0].findIndex((v, k) => v !== vertices[3][k]);
      const ds = vertices[1][sAxis] - vertices[0][sAxis],
        dt = vertices[3][tAxis] - vertices[0][tAxis];
      let rectangles: Rect[] = [[0, 0, 1, 1]];
      for (let j = 0; j < bounds.length && rectangles.length; j++) {
        if (i === j) continue;
        // Cutout leaves do not fully obscure the solid bark behind their holes.
        if (boxes[j].part === "leaves") continue;
        const [min, max] = bounds[j];
        if (min[axis] > plane + EPS || max[axis] < plane - EPS) continue;
        const edge = positive ? max[axis] : min[axis];
        const extendsOut = positive ? edge > plane + EPS : edge < plane - EPS;
        if (!extendsOut && !(Math.abs(edge - plane) < EPS && j < i)) continue;
        const ss = [
          (min[sAxis] - vertices[0][sAxis]) / ds,
          (max[sAxis] - vertices[0][sAxis]) / ds,
        ];
        const tt = [
          (min[tAxis] - vertices[0][tAxis]) / dt,
          (max[tAxis] - vertices[0][tAxis]) / dt,
        ];
        const cover: Rect = [
          Math.min(...ss),
          Math.min(...tt),
          Math.max(...ss),
          Math.max(...tt),
        ];
        rectangles = rectangles.flatMap((rect) => subtract(rect, cover));
      }
      for (const crop of rectangles) {
        const [s0, t0, s1, t1] = crop;
        result.push({
          box: i,
          crop,
          vertices: [
            [s0, t0],
            [s1, t0],
            [s1, t1],
            [s0, t1],
          ].map(([s, t]) =>
            vertices[0].map(
              (v, k) => v + s * (vertices[1][k] - v) + t * (vertices[3][k] - v),
            ),
          ),
        });
      }
    }
  }
  return result;
}
