import { ShapeUtils, Vector2 } from "three";
import { tileAt, type Tile, type Chunk } from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import {
  barkMaterial,
  crop,
  mirror,
  texturePoint,
  triangle,
  type TreeUV,
  type Point,
} from "./tree-geometry.js";
type XY = [number, number];
function clipPolygon(
  points: XY[],
  axis: number,
  bound: number,
  sign: number,
): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      da = (a[axis] - bound) * sign,
      db = (b[axis] - bound) * sign;
    if (da >= -1e-9) out.push(a);
    if (da < 0 !== db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Boundary of the occupied section, including inner holes. The outline is
 * inset before its convex corners are rounded, so it cannot reveal a hidden
 * neighbouring cell or turn an L-shaped trunk into a filled bounding box. */
export function trunkOutlines(cells: XY[], inset: number): XY[][] {
  const occupied = new Set(cells.map((p) => p.join(","))),
    edges = new Map<string, XY[]>();
  const add = (a: XY, b: XY) => {
    const k = a.join(","),
      list = edges.get(k) ?? [];
    list.push(b);
    edges.set(k, list);
  };
  for (const [x, y] of cells) {
    if (!occupied.has(`${x},${y - 1}`)) add([x, y], [x + 1, y]);
    if (!occupied.has(`${x + 1},${y}`)) add([x + 1, y], [x + 1, y + 1]);
    if (!occupied.has(`${x},${y + 1}`)) add([x + 1, y + 1], [x, y + 1]);
    if (!occupied.has(`${x - 1},${y}`)) add([x, y + 1], [x, y]);
  }
  const loops: XY[][] = [];
  while (edges.size) {
    const start = [...edges.keys()][0],
      raw: XY[] = [],
      first = start.split(",").map(Number) as XY;
    let p = first;
    for (let i = 0; i < cells.length * 8 + 4; i++) {
      raw.push(p);
      const k = p.join(","),
        list = edges.get(k);
      if (!list?.length) break;
      const n = list.shift()!;
      if (!list.length) edges.delete(k);
      p = n;
      if (p.join(",") === start) break;
    }
    const corners = raw.filter((p, i) => {
      const a = raw[(i + raw.length - 1) % raw.length],
        b = raw[(i + 1) % raw.length];
      return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
    });
    if (corners.length < 3) continue;
    const shifted = corners.map((p, i) => {
      const a = corners[(i + corners.length - 1) % corners.length],
        b = corners[(i + 1) % corners.length],
        la = Math.hypot(p[0] - a[0], p[1] - a[1]),
        lb = Math.hypot(b[0] - p[0], b[1] - p[1]),
        u = [(p[0] - a[0]) / la, (p[1] - a[1]) / la],
        v = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
      return [
        p[0] + (-u[1] - v[1]) * inset,
        p[1] + (u[0] + v[0]) * inset,
      ] as XY;
    });
    const rounded: XY[] = [];
    for (let i = 0; i < shifted.length; i++) {
      const p = shifted[i],
        a = shifted[(i + shifted.length - 1) % shifted.length],
        b = shifted[(i + 1) % shifted.length],
        la = Math.hypot(p[0] - a[0], p[1] - a[1]),
        lb = Math.hypot(b[0] - p[0], b[1] - p[1]),
        u = [(p[0] - a[0]) / la, (p[1] - a[1]) / la],
        v = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb],
        convex = u[0] * v[1] - u[1] * v[0] > 0,
        r = Math.min(convex ? 0.43 : 0.06, la * 0.45, lb * 0.45);
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        rounded.push([
          p[0] - (1 - t) ** 2 * u[0] * r + t * t * v[0] * r,
          p[1] - (1 - t) ** 2 * u[1] * r + t * t * v[1] * r,
        ]);
      }
    }
    loops.push(rounded);
  }
  return loops.sort(
    (a, b) =>
      Math.abs(ShapeUtils.area(b.map((p) => new Vector2(...p)))) -
      Math.abs(ShapeUtils.area(a.map((p) => new Vector2(...p)))),
  );
}

export function appendTrunkSection(
  out: MeshData,
  t: Tile,
  cells: XY[],
  z: number,
  chunks: Map<string, Chunk>,
  uv: TreeUV,
) {
  const above = cells.some(([x, y]) => {
    const n = tileAt(chunks, x, y, z + 1);
    return (
      n?.shape !== "unknown" &&
      n?.tree?.species === t.tree?.species &&
      /TRUNK/.test(n?.treeGraphic ?? "") &&
      !/SLOPING/.test(n?.treeGraphic ?? "")
    );
  });
  const attachments = cells.filter(([x, y]) => {
    const n = tileAt(chunks, x, y, z + 1);
    return (
      n?.shape !== "unknown" &&
      n?.tree?.species === t.tree?.species &&
      !!n?.treeGraphic
    );
  });
  const crown = (x: number, y: number) =>
    above || !attachments.length
      ? 1
      : 0.7 +
        0.3 *
          Math.exp(
            -Math.min(
              ...attachments.map(
                ([a, b]) => (x - a - 0.5) ** 2 + (y - b - 0.5) ** 2,
              ),
            ) / 0.15,
          );
  const source = barkMaterial(t),
    rect = uv(source);
  const controlHeights = [0, 0.18, 0.4, 0.65, 0.84, 1],
    controlInsets = [0.21, 0.13, 0.1, 0.1, 0.14, above ? 0.13 : 0.24],
    heights = [...controlHeights],
    period = (source?.height ?? 20) / 32;
  for (
    let h = (Math.floor(z / period) + 1) * period - z;
    h < 1 - 1e-8;
    h += period
  )
    if (h > 1e-8) heights.push(h);
  heights.sort((a, b) => a - b);
  const rings = heights.map((h) => {
    let j = 0;
    while (j + 1 < controlHeights.length - 1 && controlHeights[j + 1] < h) j++;
    const blend =
      (h - controlHeights[j]) / (controlHeights[j + 1] - controlHeights[j]);
    return trunkOutlines(
      cells,
      controlInsets[j] * (1 - blend) + controlInsets[j + 1] * blend,
    );
  });
  for (let loop = 0; loop < rings[0].length; loop++) {
    const count = rings[0][loop].length,
      divisions = Array.from({ length: count }, (_, i) =>
        Math.max(
          1,
          Math.ceil(
            Math.max(
              ...rings.map((r) =>
                Math.hypot(
                  r[loop][(i + 1) % count][0] - r[loop][i][0],
                  r[loop][(i + 1) % count][1] - r[loop][i][1],
                ),
              ),
            ) / 0.06,
          ),
        ),
      );
    for (const ring of rings) {
      const raw = ring[loop];
      ring[loop] = raw.flatMap((a, i) =>
        Array.from({ length: divisions[i] }, (_, j) => {
          const b = raw[(i + 1) % count],
            t = j / divisions[i];
          return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t] as XY;
        }),
      );
    }
  }
  for (let loop = 0; loop < rings[0].length; loop++) {
    const distance = [0],
      base = rings[2][loop];
    for (let i = 1; i <= base.length; i++)
      distance.push(
        distance[i - 1] +
          Math.hypot(
            base[i % base.length][0] - base[i - 1][0],
            base[i % base.length][1] - base[i - 1][1],
          ),
      );
    for (let j = 0; j + 1 < heights.length; j++)
      for (let i = 0; i < base.length; i++) {
        const n = (i + 1) % base.length,
          points = [
            rings[j][loop][i],
            rings[j + 1][loop][i],
            rings[j + 1][loop][n],
            rings[j][loop][n],
          ],
          p = points.map((a, k) => {
            const h = heights[j + (k === 1 || k === 2 ? 1 : 0)];
            return [
              a[0],
              z + h - (1 - crown(a[0], a[1])) * Math.max(0, (h - 0.65) / 0.35),
              a[1],
            ] as Point;
          });
        const dx = base[n][0] - base[i][0],
          dy = base[n][1] - base[i][1],
          len = Math.hypot(dx, dy),
          shade = 0.79 + (0.14 * (dy - dx)) / (Math.max(len, 1e-8) * 1.414);
        const coords = p.map((a, k) =>
          texturePoint(
            rect,
            mirror(
              (distance[i + (k > 1 ? 1 : 0)] * 32) / (source?.width ?? 16),
            ),
            mirror((a[1] * 32) / (source?.height ?? 20)),
          ),
        );
        triangle(out, [p[0], p[1], p[2]], coords.slice(0, 3), [
          shade,
          shade,
          shade,
        ]);
        triangle(
          out,
          [p[0], p[2], p[3]],
          [coords[0], coords[2], coords[3]],
          [shade, shade, shade],
        );
      }
  }
  for (const j of [0, heights.length - 1]) {
    const loops = rings[j],
      all = loops.flat(),
      faces = ShapeUtils.triangulateShape(
        loops[0].map((p) => new Vector2(...p)),
        loops.slice(1).map((l) => l.map((p) => new Vector2(...p))),
      );
    for (const [x, y] of cells) {
      const native = tileAt(chunks, x, y, z),
        cap = uv(native?.tree?.cap ?? native?.tree?.bark, true);
      const grid = j !== 0 && !above && attachments.length ? 8 : 1;
      for (const face of faces) {
        const vertices = face.map((i) => all[i]),
          minGX = Math.max(
            0,
            Math.floor((Math.min(...vertices.map((p) => p[0])) - x) * grid),
          ),
          maxGX = Math.min(
            grid - 1,
            Math.floor((Math.max(...vertices.map((p) => p[0])) - x) * grid),
          ),
          minGY = Math.max(
            0,
            Math.floor((Math.min(...vertices.map((p) => p[1])) - y) * grid),
          ),
          maxGY = Math.min(
            grid - 1,
            Math.floor((Math.max(...vertices.map((p) => p[1])) - y) * grid),
          );
        for (let gx = minGX; gx <= maxGX; gx++)
          for (let gy = minGY; gy <= maxGY; gy++) {
            let polygon = vertices;
            for (const [axis, bound, sign] of [
              [0, x + gx / grid, 1],
              [0, x + (gx + 1) / grid, -1],
              [1, y + gy / grid, 1],
              [1, y + (gy + 1) / grid, -1],
            ])
              polygon = clipPolygon(polygon, axis, bound, sign);
            for (let i = 1; i + 1 < polygon.length; i++) {
              const order = j === 0 ? [0, i, i + 1] : [0, i + 1, i],
                points = order.map(
                  (k) =>
                    [
                      polygon[k][0],
                      z + (j === 0 ? 0 : crown(...polygon[k])),
                      polygon[k][1],
                    ] as Point,
                ),
                shade = j === 0 ? 0.65 : 0.92;
              triangle(
                out,
                points,
                points.map((p) =>
                  texturePoint(
                    cap,
                    Math.max(0, Math.min(1, p[0] - x)),
                    Math.max(0, Math.min(1, 1 - (p[2] - y))),
                  ),
                ),
                [shade, shade, shade],
              );
            }
          }
      }
    }
  }
}
