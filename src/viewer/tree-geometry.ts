import * as THREE from "three";
import type { SpriteRef, Tile } from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import type { TerrainUV } from "./terrain-atlas.js";

export type Point = [number, number, number];
export type TreeUV = (ref?: SpriteRef, transparent?: boolean) => TerrainUV;
export const treeId = (t: Tile) =>
  (t.tree?.speciesId ?? t.tree?.species ?? "")
    .toUpperCase()
    .replace(/ TREE$/, "")
    .replaceAll(" ", "_");
export function noise(x: number, y: number, z: number) {
  let h =
    Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function crop(
  ref: SpriteRef | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return (
    ref && {
      ...ref,
      x: ref.x + Math.round(x * ref.width),
      y: ref.y + Math.round(y * ref.height),
      width: Math.max(1, Math.round(w * ref.width)),
      height: Math.max(1, Math.round(h * ref.height)),
    }
  );
}
export function barkMaterial(t: Tile) {
  const id = treeId(t),
    ref = t.tree?.bark;
  // These native pillars are sections through pith or a hollow tube. Their
  // exterior is the opaque annulus, not the centre of the cross-section.
  if (id === "SAGUARO") return crop(ref, 4 / 32, 14 / 32, 2 / 32, 4 / 32);
  if (id === "TUNNEL_TUBE")
    return crop(t.tree?.side ?? ref, 12 / 32, 2 / 32, 8 / 32, 28 / 32);
  if (id === "PAPAYA") return crop(ref, 0.25, 0.25, 0.125, 0.125);
  return crop(t.tree?.side ?? ref, 0.25, 10 / 32, 0.5, 20 / 32);
}
export function triangle(
  out: MeshData,
  vertices: Point[],
  coords: number[][],
  shades: number[],
) {
  for (let i = 0; i < 3; i++) {
    out.positions.push(...vertices[i]);
    out.uvs.push(...coords[i]);
    out.colors.push(shades[i], shades[i], shades[i]);
  }
}
export const texturePoint = (rect: TerrainUV, u: number, v: number) => [
  rect[0] + (rect[2] - rect[0]) * u,
  rect[1] + (rect[3] - rect[1]) * v,
];
export const mirror = (n: number) => 1 - Math.abs((((n % 2) + 2) % 2) - 1);

/** A bent, tapered limb with a shared tangent at each ring, closed at its tips. */
export function limb(
  out: MeshData,
  points: Point[],
  radii: number[],
  ref: SpriteRef | undefined,
  uv: TreeUV,
  segments = 10,
  hollow = false,
) {
  const rect = uv(ref),
    original = points.map((p) => new THREE.Vector3(...p)),
    period = (ref?.height ?? 20) / 32;
  const lengths = [0];
  for (let j = 1; j < original.length; j++)
    lengths.push(lengths[j - 1] + original[j].distanceTo(original[j - 1]));
  const total = lengths.at(-1)!;
  if (total < 1e-8) return;
  const stops = [...lengths];
  for (let d = period; d < total - 1e-8; d += period) stops.push(d);
  stops.sort((a, b) => a - b);
  const vectors = stops.map((d) => {
    let i = 0;
    while (i + 1 < lengths.length - 1 && lengths[i + 1] < d) i++;
    return original[i]
      .clone()
      .lerp(original[i + 1], (d - lengths[i]) / (lengths[i + 1] - lengths[i]));
  });
  const sizes = stops.map((d) => {
    let i = 0;
    while (i + 1 < lengths.length - 1 && lengths[i + 1] < d) i++;
    const t = (d - lengths[i]) / (lengths[i + 1] - lengths[i]);
    return radii[i] * (1 - t) + radii[i + 1] * t;
  });
  const repeats = Math.max(
    1,
    Math.round((2 * Math.PI * Math.max(...radii) * 32) / (ref?.width ?? 16)),
  );
  segments = Math.max(segments, repeats * 4);
  segments = Math.ceil(segments / repeats) * repeats;
  const rings = vectors.map((p, j) => {
    const direction = vectors[Math.min(j + 1, vectors.length - 1)]
      .clone()
      .sub(vectors[Math.max(j - 1, 0)])
      .normalize();
    const u = new THREE.Vector3()
      .crossVectors(
        direction,
        Math.abs(direction.y) > 0.95
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0),
      )
      .normalize();
    const v = new THREE.Vector3().crossVectors(u, direction);
    return Array.from(
      { length: segments },
      (_, i) =>
        p
          .clone()
          .addScaledVector(u, Math.cos((i / segments) * Math.PI * 2) * sizes[j])
          .addScaledVector(v, Math.sin((i / segments) * Math.PI * 2) * sizes[j])
          .toArray() as Point,
    );
  });
  const shade = (i: number) =>
    0.77 + 0.16 * Math.cos((i / segments) * Math.PI * 2 - 0.6);
  for (let j = 0; j + 1 < rings.length; j++)
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments,
        a = rings[j][i],
        b = rings[j + 1][i],
        c = rings[j + 1][n],
        d = rings[j][n];
      const u = mirror((i / segments) * repeats),
        u1 = mirror(((i + 1) / segments) * repeats),
        v = mirror(stops[j] / period),
        v1 = mirror(stops[j + 1] / period);
      const coords = [
        texturePoint(rect, u, v),
        texturePoint(rect, u, v1),
        texturePoint(rect, u1, v1),
        texturePoint(rect, u1, v),
      ];
      triangle(out, [a, b, c], coords.slice(0, 3), [
        shade(i),
        shade(i),
        shade(n),
      ]);
      triangle(
        out,
        [a, c, d],
        [coords[0], coords[2], coords[3]],
        [shade(i), shade(n), shade(n)],
      );
    }
  if (!hollow)
    for (const j of [0, rings.length - 1])
      for (let i = 0; i < segments; i++) {
        const pair =
          j === 0 ? [i, (i + 1) % segments] : [(i + 1) % segments, i];
        triangle(
          out,
          [vectors[j].toArray() as Point, rings[j][pair[0]], rings[j][pair[1]]],
          [
            texturePoint(rect, 0.5, 0.5),
            texturePoint(rect, 0.2, 0.2),
            texturePoint(rect, 0.8, 0.8),
          ],
          [0.8, 0.8, 0.8],
        );
      }
}
