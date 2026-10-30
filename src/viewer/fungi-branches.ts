import * as THREE from "three";
import {
  tileAt,
  type Tile,
  type Chunk,
  type SpriteRef,
} from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import type { TerrainUV } from "./terrain-atlas.js";
import { core } from "./fungi-caps.js";
export const roundFungalBranches = (t: Tile) =>
  t.shape !== "unknown" &&
  /fungiwood/i.test(t.tree?.species ?? "") &&
  /BRANCH|TWIG|SLOPING/.test(t.treeGraphic ?? "");
export function appendFungalBranches(
  out: MeshData,
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
  uv: (ref?: SpriteRef) => TerrainUV,
) {
  const rect = uv(core(t.tree?.bark ?? t.tree?.side)),
    radius = /TWIG/.test(t.treeGraphic ?? "") ? 0.05 : 0.11;
  const center = new THREE.Vector3(x + 0.5, z + 0.28, y + 0.5);
  const mirrored = (n: number) => 1 - Math.abs((((n % 2) + 2) % 2) - 1);
  const coords = (a: number, b: number) => [
    rect[0] + (rect[2] - rect[0]) * mirrored(a),
    rect[1] + (rect[3] - rect[1]) * mirrored(b),
  ];
  const related = (n: Tile | undefined) =>
    !!n &&
    n.shape !== "unknown" &&
    n.tree?.species === t.tree?.species &&
    /TRUNK|BRANCH|SLOPING/.test(n.treeGraphic ?? "");
  function tube(end: THREE.Vector3) {
    const direction = end.clone().sub(center).normalize(),
      start = center.clone().addScaledVector(direction, -0.012),
      finish = end.clone().addScaledVector(direction, 0.012);
    const u = new THREE.Vector3()
        .crossVectors(
          direction,
          Math.abs(direction.y) > 0.9
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 1, 0),
        )
        .normalize(),
      v = new THREE.Vector3().crossVectors(u, direction);
    const axis =
      Math.abs(direction.x) > 0.5 ? 0 : Math.abs(direction.y) > 0.5 ? 1 : 2;
    const point = (p: THREE.Vector3, a: number) =>
      p
        .clone()
        .addScaledVector(u, Math.cos(a) * radius)
        .addScaledVector(v, Math.sin(a) * radius);
    const triangle = (
      points: THREE.Vector3[],
      texture: number[][],
      shade: number,
    ) => {
      for (let i = 0; i < 3; i++) {
        out.positions.push(...points[i].toArray());
        out.uvs.push(...texture[i]);
        out.colors.push(shade, shade, shade);
      }
    };
    const middle = coords(0.5, 0.5);
    const stops = [start, finish];
    const first = Math.min(start.getComponent(axis), finish.getComponent(axis)),
      last = Math.max(start.getComponent(axis), finish.getComponent(axis));
    for (
      let coordinate = Math.ceil(first * 2) / 2;
      coordinate < last;
      coordinate += 0.5
    ) {
      const distance =
        (coordinate - start.getComponent(axis)) / direction.getComponent(axis);
      if (distance > 1e-8 && distance < start.distanceTo(finish) - 1e-8)
        stops.push(start.clone().addScaledVector(direction, distance));
    }
    stops.sort(
      (a, b) => a.distanceToSquared(start) - b.distanceToSquared(start),
    );
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        b = ((i + 1) / 16) * Math.PI * 2;
      for (let segment = 0; segment + 1 < stops.length; segment++) {
        const p0 = point(stops[segment], a),
          p1 = point(stops[segment + 1], a),
          p2 = point(stops[segment + 1], b),
          p3 = point(stops[segment], b);
        const c0 = coords(p0.getComponent(axis) * 2, i / 4),
          c1 = coords(p1.getComponent(axis) * 2, i / 4),
          c2 = coords(p2.getComponent(axis) * 2, (i + 1) / 4),
          c3 = coords(p3.getComponent(axis) * 2, (i + 1) / 4);
        const shade = 0.84 + 0.08 * Math.cos((a + b) / 2);
        triangle([p0, p1, p2], [c0, c1, c2], shade);
        triangle([p0, p2, p3], [c0, c2, c3], shade);
      }
      const disk = (angle: number) =>
        coords(0.5 + Math.cos(angle) * 0.42, 0.5 + Math.sin(angle) * 0.42);
      triangle(
        [start, point(start, a), point(start, b)],
        [middle, disk(a), disk(b)],
        0.84,
      );
      triangle(
        [finish, point(finish, b), point(finish, a)],
        [middle, disk(b), disk(a)],
        0.92,
      );
    }
  }
  const letters =
    /(?:BRANCH|TWIG|SLOPING)_?([NSEW_]*)$/
      .exec(t.treeGraphic ?? "")?.[1]
      .replaceAll("_", "") || "NSEW";
  for (const [letter, dx, dy] of [
    ["N", 0, -1],
    ["S", 0, 1],
    ["E", 1, 0],
    ["W", -1, 0],
  ] as const) {
    const neighbour = tileAt(chunks, x + dx, y + dy, z),
      trunk = related(neighbour) && /TRUNK/.test(neighbour!.treeGraphic!);
    if (letters.includes(letter) || trunk)
      tube(
        center
          .clone()
          .add(
            new THREE.Vector3(
              dx * (trunk ? 1 : 0.5),
              0,
              dy * (trunk ? 1 : 0.5),
            ),
          ),
      );
  }
  if (related(tileAt(chunks, x, y, z + 1)))
    tube(new THREE.Vector3(x + 0.5, z + 1.1, y + 0.5));
  if (related(tileAt(chunks, x, y, z - 1)))
    tube(new THREE.Vector3(x + 0.5, z - 0.05, y + 0.5));
}
