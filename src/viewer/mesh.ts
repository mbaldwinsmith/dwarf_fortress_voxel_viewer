import {
  tileAt,
  type Chunk,
  type Tile,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
import { rampSurface } from "./ramps.js";
export interface MeshData {
  positions: number[];
  colors: number[];
  uvs: number[];
}
const palette: Record<number, number[]> = {
  1: [0.44, 0.32, 0.22],
  2: [0.48, 0.53, 0.57],
  3: [0.35, 0.42, 0.48],
  4: [0.25, 0.27, 0.3],
  5: [0.59, 0.48, 0.31],
  6: [0.48, 0.72, 0.8],
  7: [0.65, 0.61, 0.5],
  8: [0.37, 0.5, 0.23],
  9: [0.25, 0.39, 0.18],
  10: [0.53, 0.47, 0.26],
  23: [0.39, 0.27, 0.16],
};
export function linearMaterialColor(rgb: number[]) {
  return rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}
function solid(t: Tile | undefined) {
  return (t?.shape === "wall" && !t.treeGraphic) || t?.shape === "unknown";
}
export function buildMesh(
  c: Chunk,
  chunks: Map<string, Chunk>,
  cut: number,
  textureUV: (ref?: SpriteRef) => TerrainUV = () => [0, 0, 1, 1],
): MeshData {
  const out: MeshData = { positions: [], colors: [], uvs: [] };
  let surfaces: Tile["surfaces"];
  const treeSprites = new Set(
    (c.objects ?? [])
      .filter((o) => o.kind === "plant" && o.sprite)
      .map((o) => (o.y - c.y) * 16 + o.x - c.x),
  );
  if (c.z > cut) return out;
  function quad(v: number[][], color: number[]) {
    const horizontal =
      v.every((p) => p[1] === v[0][1]) ||
      !(v.every((p) => p[0] === v[0][0]) || v.every((p) => p[2] === v[0][2]));
    const faceColor =
      horizontal && surfaces?.topTint
        ? linearMaterialColor(surfaces.topTint)
        : color;
    const [left, bottom, right, top] = textureUV(
      horizontal ? surfaces?.top : surfaces?.side,
    );
    const uv = horizontal
      ? [
          [left, bottom],
          [right, bottom],
          [right, top],
          [left, top],
        ]
      : [
          [left, bottom],
          [left, top],
          [right, top],
          [right, bottom],
        ];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      out.positions.push(...v[i]);
      out.colors.push(...faceColor);
      out.uvs.push(...uv[i]);
    }
  }
  for (let i = 0; i < 256; i++) {
    const t = c.tiles[i];
    if (!t || t.shape === "empty") continue;
    surfaces = t.shape === "unknown" ? undefined : t.surfaces;
    const x = c.x + (i % 16),
      y = c.y + Math.floor(i / 16),
      z = c.z;
    const color =
      t.shape === "unknown"
        ? [0.09, 0.105, 0.12]
        : t.color
          ? linearMaterialColor(t.color)
          : (palette[t.material] ?? [0.53, 0.52, 0.46]);
    function box(
      h: number,
      dx = 0,
      dy = 0,
      w = 1,
      d = 1,
      base = 0,
      cull = false,
    ) {
      const a = x + dx,
        b = y + dy,
        l = z + base,
        u = l + h;
      const neighbour = (nx: number, ny: number, nz: number) =>
        nz <= cut && solid(tileAt(chunks, nx, ny, nz));
      if (!cull || !neighbour(x + 1, y, z))
        quad(
          [
            [a + w, l, b],
            [a + w, u, b],
            [a + w, u, b + d],
            [a + w, l, b + d],
          ],
          color,
        );
      if (!cull || !neighbour(x - 1, y, z))
        quad(
          [
            [a, l, b + d],
            [a, u, b + d],
            [a, u, b],
            [a, l, b],
          ],
          color,
        );
      if (!cull || !neighbour(x, y + 1, z))
        quad(
          [
            [a + w, l, b + d],
            [a + w, u, b + d],
            [a, u, b + d],
            [a, l, b + d],
          ],
          color,
        );
      if (!cull || !neighbour(x, y - 1, z))
        quad(
          [
            [a, l, b],
            [a, u, b],
            [a + w, u, b],
            [a + w, l, b],
          ],
          color,
        );
      if (!cull || !neighbour(x, y, z + 1))
        quad(
          [
            [a, u, b + d],
            [a + w, u, b + d],
            [a + w, u, b],
            [a, u, b],
          ],
          color,
        );
      if (!cull || !neighbour(x, y, z - 1))
        quad(
          [
            [a, l, b],
            [a + w, l, b],
            [a + w, l, b + d],
            [a, l, b + d],
          ],
          color,
        );
    }
    if (t.treeGraphic && treeSprites.has(i)) box(0.12);
    else if (t.shape === "wall" || t.shape === "unknown")
      box(1, 0, 0, 1, 1, 0, true);
    else if (t.shape === "stairs") {
      box(0.12);
      for (let s = 0; s < 4; s++)
        box((s + 1) * 0.22, 0, s / 4, 0.65, 0.25, 0.12);
    } else if (t.shape === "ramp") {
      const { corners, center } = rampSurface(chunks, x, y, z);
      // Clockwise in map XY, counterclockwise when viewed from above in Three.js.
      const offsets = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      const top = offsets.map(([dx, dy], i) => [
        x + dx,
        z + corners[i],
        y + dy,
      ]);
      const middle = [x + 0.5, z + center, y + 0.5];
      for (let edge = 0; edge < 4; edge++) {
        const a = top[edge],
          b = top[(edge + 1) % 4];
        quad([a, b, middle, middle], color);
        quad([[a[0], z, a[2]], [b[0], z, b[2]], b, a], color);
      }
      quad(
        [
          [x, z, y],
          [x + 1, z, y],
          [x + 1, z, y + 1],
          [x, z, y + 1],
        ],
        color,
      );
    } else box(0.12);
  }
  return out;
}
