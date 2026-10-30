import {
  tileAt,
  type Tile,
  type Chunk,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
import type { MeshData } from "./mesh.js";
import { core } from "./fungi-caps.js";
function stemSection(
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
) {
  const points: [number, number][] = [[x, y]],
    seen = new Set([`${x},${y}`]);
  for (let i = 0; i < points.length && points.length < 64; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [a, b] = points[i],
        nx = a + dx,
        ny = b + dy,
        key = `${nx},${ny}`,
        n = tileAt(chunks, nx, ny, z);
      if (
        !seen.has(key) &&
        n &&
        roundFungalStem(n) &&
        n.tree?.species === t.tree?.species
      ) {
        seen.add(key);
        points.push([nx, ny]);
      }
    }
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const rectangular = points.length === (maxX - minX + 1) * (maxY - minY + 1);
  return {
    points,
    owner: !rectangular || (x === minX && y === minY),
    spanX: rectangular ? maxX - minX + 1 : 1,
    spanY: rectangular ? maxY - minY + 1 : 1,
    centerX: rectangular ? (minX + maxX + 1) / 2 : x + 0.5,
    centerY: rectangular ? (minY + maxY + 1) / 2 : y + 0.5,
  };
}
export function roundFungalStem(t: Tile) {
  return (
    t.shape !== "unknown" &&
    /TRUNK/.test(t.treeGraphic ?? "") &&
    (t.tree?.roundStem ||
      /tower.?cap|nether.?cap|goblin.?cap|black.?cap|fungiwood/i.test(
        t.tree?.species ?? "",
      ))
  );
}
// The native pillar is a round cross-section. Extrude that disk rather than
// projecting its transparent square corners onto four vertical panels.
export function appendFungalStem(
  out: MeshData,
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
  uv: (ref?: SpriteRef) => TerrainUV,
) {
  const section = stemSection(t, x, y, z, chunks);
  if (!section.owner) return;
  const { spanX, spanY, centerX, centerY } = section;
  const next = section.points.find(([a, b]) => {
    const n = tileAt(chunks, a, b, z + 1);
    return n && roundFungalStem(n) && n.tree?.species === t.tree?.species;
  });
  const upperSection = next
    ? stemSection(
        tileAt(chunks, next[0], next[1], z + 1)!,
        next[0],
        next[1],
        z + 1,
        chunks,
      )
    : section;
  const ref = t.tree?.bark ?? t.tree?.cap,
    side = uv(core(ref)),
    top = uv(ref);
  const radius = 0.5 - 1 / Math.max(8, ref?.width ?? 32),
    segments = 32;
  const above = tileAt(chunks, x, y, z + 1),
    below = tileAt(chunks, x, y, z - 1);
  const joinsCap = /CAP/.test(above?.treeGraphic ?? "");
  const capHeight = /FLOOR/.test(above?.treeGraphic ?? "")
    ? 0.22
    : /RAMP/.test(above?.treeGraphic ?? "")
      ? 0.8
      : 1;
  const upper = z + 1 + (joinsCap ? Math.min(0.4, capHeight * 0.55) : 0);
  const mirrored = (v: number) => 1 - Math.abs((((v % 2) + 2) % 2) - 1);
  const sideUV = (u: number, v: number) => [
    side[0] + (side[2] - side[0]) * mirrored(u),
    side[1] + (side[3] - side[1]) * mirrored(v),
  ];
  const push = (vertices: number[][], coords: number[][], shade: number[]) => {
    for (let i = 0; i < 3; i++) {
      out.positions.push(...vertices[i]);
      out.uvs.push(...coords[i]);
      out.colors.push(shade[i], shade[i], shade[i]);
    }
  };
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2,
      b = ((i + 1) / segments) * Math.PI * 2;
    const p = (angle: number, height: number) => {
      const blend = Math.max(0, Math.min(1, height - z));
      const mix = (a: number, b: number) => a + (b - a) * blend;
      return [
        mix(centerX, upperSection.centerX) +
          Math.cos(angle) *
            (mix(spanX, upperSection.spanX) / 2 - (0.5 - radius)),
        height,
        mix(centerY, upperSection.centerY) +
          Math.sin(angle) *
            (mix(spanY, upperSection.spanY) / 2 - (0.5 - radius)),
      ];
    };
    const shade = (angle: number) =>
      0.84 + 0.12 * (Math.cos(angle) * -0.5 + Math.sin(angle) * 0.5);
    const u0 = (i / segments) * 4,
      u1 = ((i + 1) / segments) * 4;
    for (let low = z; low < upper - 1e-8; low += 0.25) {
      const high = Math.min(upper, low + 0.25),
        p0 = p(a, low),
        p1 = p(a, high),
        p2 = p(b, high),
        p3 = p(b, low),
        v0 = sideUV(u0, low * 2),
        v1 = sideUV(u0, high * 2),
        v2 = sideUV(u1, high * 2),
        v3 = sideUV(u1, low * 2);
      push([p0, p1, p2], [v0, v1, v2], [shade(a), shade(a), shade(b)]);
      push([p0, p2, p3], [v0, v2, v3], [shade(a), shade(b), shade(b)]);
    }
    const diskUV = (angle: number) => [
      top[0] + (top[2] - top[0]) * (0.5 + Math.cos(angle) * radius),
      top[1] + (top[3] - top[1]) * (0.5 - Math.sin(angle) * radius),
    ];
    const middle = [(top[0] + top[2]) / 2, (top[1] + top[3]) / 2];
    if (!next)
      push(
        [[centerX, upper, centerY], p(b, upper), p(a, upper)],
        [middle, diskUV(b), diskUV(a)],
        [1, 1, 1],
      );
    if (!/TRUNK/.test(below?.treeGraphic ?? ""))
      push(
        [[centerX, z, centerY], p(a, z), p(b, z)],
        [middle, diskUV(a), diskUV(b)],
        [0.8, 0.8, 0.8],
      );
  }
}
