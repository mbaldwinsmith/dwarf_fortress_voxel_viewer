import { tileAt, type Tile, type Chunk } from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import {
  crop,
  mirror,
  noise,
  texturePoint,
  treeId,
  triangle,
  type Point,
  type TreeUV,
} from "./tree-geometry.js";

export function appendTreeFoliage(
  out: MeshData,
  t: Tile,
  x: number,
  y: number,
  z: number,
  uv: TreeUV,
  chunks: Map<string, Chunk>,
) {
  const id = treeId(t),
    token = t.treeGraphic ?? "";
  if (
    t.shape === "unknown" ||
    !/TWIG/.test(token) ||
    /DEAD|LEAFLESS/.test(token) ||
    !t.tree?.leaves ||
    /GLUMPRONG|BLOOD_THORN|SAGUARO|TUNNEL_TUBE/.test(id)
  )
    return;
  const spore = id === "SPORE_TREE",
    fungal = id === "FUNGIWOOD" || spore,
    ref = spore
      ? crop(t.tree.cap, 4 / 32, 12 / 32, 8 / 32, 8 / 32)
      : id === "FUNGIWOOD"
        ? crop(t.tree.leaves, 0.25, 0.25, 0.5, 0.5)
        : t.tree.leaves,
    rect = uv(ref, !fungal),
    needle = /PINE|CEDAR|LARCH/.test(id),
    segments = 18,
    rings = 10;
  const lobes: number[][] = [];
  for (let lobe = 0; lobe < 3; lobe++) {
    const seed = noise(x + lobe * 19, y - lobe * 7, z),
      angle = (lobe * Math.PI) / 2 + seed * 0.55;
    const primary = lobe === 0 && !fungal,
      cx = 0.5 + (primary ? 0 : Math.cos(angle) * (fungal ? 0.22 : 0.18)),
      cy = 0.5 + (primary ? 0 : Math.sin(angle) * (fungal ? 0.22 : 0.18));
    const other = noise(x + 79 + lobe, y - 31, z + 13),
      cz = primary ? 0.42 + seed * 0.16 : 0.48 + seed * 0.16,
      rx = primary
        ? 0.34 + seed * 0.1
        : fungal
          ? 0.17 + seed * 0.075
          : 0.16 + seed * 0.12,
      ry = primary ? (needle ? 0.28 : 0.22) + other * 0.12 : 0.18 + seed * 0.08,
      rz = primary
        ? 0.25 + other * 0.16
        : fungal
          ? 0.17 + (1 - seed) * 0.075
          : 0.16 + (1 - seed) * 0.11;
    lobes.push([cx, cy, cz, rx, ry, rz, seed, fungal ? 0 : other * Math.PI]);
  }
  if (!fungal)
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const n = tileAt(chunks, x + dx, y + dy, z);
      if (
        n &&
        n.shape !== "unknown" &&
        n.tree?.species === t.tree?.species &&
        /TWIG/.test(n.treeGraphic ?? "") &&
        !/DEAD|LEAFLESS/.test(n.treeGraphic ?? "")
      )
        lobes.push([
          0.5 + dx * 0.5,
          0.5 + dy * 0.5,
          0.52,
          0.33,
          0.24,
          0.33,
          noise(x + dx, y + dy, z),
          0,
        ]);
    }
  for (const [cx, cy, cz, rx, ry, rz, seed, rotation] of lobes) {
    const point = (i: number, j: number): Point => {
      const a = (i / segments) * Math.PI * 2,
        b = (j / rings) * Math.PI;
      const irregular =
        1 +
        (-0.06 +
          Math.sin(a * 3 + seed * 6) * 0.08 +
          Math.cos(a * 5 + b * 2) * 0.045) *
          Math.sin(b);
      const dx = Math.cos(a) * Math.sin(b) * rx * irregular,
        dy = Math.sin(a) * Math.sin(b) * rz * irregular;
      return [
        x + cx + dx * Math.cos(rotation) - dy * Math.sin(rotation),
        z + cz + Math.cos(b) * ry,
        y + cy + dx * Math.sin(rotation) + dy * Math.cos(rotation),
      ];
    };
    const shade = (i: number, j: number) =>
      0.78 +
      0.13 * Math.cos((j / rings) * Math.PI) +
      0.035 *
        Math.sin((j / rings) * Math.PI) *
        Math.cos((i / segments) * Math.PI * 2 - 2.2);
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        const a = point(i, j),
          b = point(i, j + 1),
          c = point(i + 1, j + 1),
          d = point(i + 1, j);
        const e = b.map((v, k) => v - a[k]),
          f = d.map((v, k) => v - a[k]),
          normal = [
            e[1] * f[2] - e[2] * f[1],
            e[2] * f[0] - e[0] * f[2],
            e[0] * f[1] - e[1] * f[0],
          ],
          axis = normal
            .map(Math.abs)
            .indexOf(Math.max(...normal.map(Math.abs)));
        const project = (p: Point) => {
          const local = [p[0] - x, p[1] - z, p[2] - y],
            u = axis === 0 ? local[2] : local[0],
            v = axis === 1 ? local[2] : local[1];
          return texturePoint(rect, mirror(u), mirror(1 - v));
        };
        if (j !== 0)
          triangle(
            out,
            [a, d, b],
            [project(a), project(d), project(b)],
            [shade(i, j), shade(i + 1, j), shade(i, j + 1)],
          );
        if (j !== rings - 1)
          triangle(
            out,
            [b, d, c],
            [project(b), project(d), project(c)],
            [shade(i, j + 1), shade(i + 1, j), shade(i + 1, j + 1)],
          );
      }
  }
}
