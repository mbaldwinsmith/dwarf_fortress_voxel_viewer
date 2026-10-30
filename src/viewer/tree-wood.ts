import { tileAt, type Tile, type Chunk } from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import {
  barkMaterial,
  crop,
  limb,
  mirror,
  noise,
  texturePoint,
  treeId,
  triangle,
  type Point,
  type TreeUV,
} from "./tree-geometry.js";
import { emptyTreeTwig, TreeTopology } from "./tree-topology.js";
import { appendTrunkSection } from "./tree-section.js";

const same = (t: Tile, n: Tile | undefined) =>
  !!n &&
  n.shape !== "unknown" &&
  !!n.treeGraphic &&
  n.tree?.species === t.tree?.species;
const trunk = (t: Tile | undefined) =>
  !!t &&
  t.shape !== "unknown" &&
  /TRUNK/.test(t.treeGraphic ?? "") &&
  !/SLOPING/.test(t.treeGraphic ?? "");

function section(
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
      const a = points[i][0] + dx,
        b = points[i][1] + dy,
        key = `${a},${b}`,
        n = tileAt(chunks, a, b, z);
      if (!seen.has(key) && same(t, n) && trunk(n)) {
        seen.add(key);
        points.push([a, b]);
      }
    }
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const rectangular = points.length === (maxX - minX + 1) * (maxY - minY + 1);
  const owner = points.reduce((a, b) =>
    a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? a : b,
  );
  return {
    points,
    rectangular,
    owner: x === owner[0] && y === owner[1],
    cx: rectangular ? (minX + maxX + 1) / 2 : x + 0.5,
    cy: rectangular ? (minY + maxY + 1) / 2 : y + 0.5,
    rx: rectangular ? (maxX - minX + 1) / 2 : 0.5,
    ry: rectangular ? (maxY - minY + 1) / 2 : 0.5,
  };
}

export function appendTreeWood(
  out: MeshData,
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
  uv: TreeUV,
  topology = new TreeTopology(chunks),
) {
  if (t.shape === "unknown" || emptyTreeTwig(t)) return;
  const token = t.treeGraphic ?? "",
    id = treeId(t),
    hollow = id === "TUNNEL_TUBE",
    surface = barkMaterial(t);
  const related = (dx: number, dy: number, dz = 0) =>
    same(t, tileAt(chunks, x + dx, y + dy, z + dz));
  if (trunk(t)) {
    const s = section(t, x, y, z, chunks);
    if (s.owner && !s.rectangular)
      appendTrunkSection(out, t, s.points, z, chunks, uv);
    if (s.owner && s.rectangular) {
      const above = tileAt(chunks, x, y, z + 1),
        below = tileAt(chunks, x, y, z - 1),
        next =
          same(t, above) && trunk(above)
            ? section(above!, x, y, z + 1, chunks)
            : undefined;
      const futureTile = tileAt(chunks, x, y, z + 2),
        future =
          next && same(t, futureTile) && trunk(futureTile)
            ? section(futureTile!, x, y, z + 2, chunks)
            : undefined;
      const root = !same(t, below) || !trunk(below),
        repeats = Math.min(
          32,
          Math.max(
            2,
            Math.round(
              (Math.PI *
                2 *
                Math.sqrt(((s.rx - 0.13) ** 2 + (s.ry - 0.13) ** 2) / 2) *
                32) /
                (surface?.width ?? 16),
            ),
          ),
        ),
        segments = repeats * 8,
        side = uv(surface),
        top = uv(
          s.rectangular
            ? t.tree?.bark
            : crop(t.tree?.bark, 0.25, 0.25, 0.5, 0.5),
        ),
        period = (surface?.height ?? 20) / 32;
      const stops = [0, 0.25, 0.5, 0.75, 1];
      for (
        let h = (Math.floor(z / period) + 1) * period - z;
        h < 1 - 1e-8;
        h += period
      )
        if (h > 1e-8) stops.push(h);
      stops.sort((a, b) => a - b);
      const contour = (i: number, h: number, inner = false): Point => {
        const angle = (i / segments) * Math.PI * 2;
        const upper =
          next &&
          next.rectangular &&
          Math.abs(next.cx - s.cx) + next.rx <= s.rx &&
          Math.abs(next.cy - s.cy) + next.ry <= s.ry
            ? next
            : s;
        const inset = (root ? 0.075 : 0.13) * (1 - h) + 0.13 * h;
        const contained = (a: typeof s, b: typeof s | undefined) =>
          b &&
          b.rectangular &&
          Math.abs(b.cx - a.cx) + b.rx <= a.rx &&
          Math.abs(b.cy - a.cy) + b.ry <= a.ry
            ? b
            : a;
        const after = contained(upper, future),
          blend = h * h * (3 - 2 * h);
        const lowX = s.cx * 0.78 + upper.cx * 0.22,
          lowY = s.cy * 0.78 + upper.cy * 0.22,
          highX = upper.cx * 0.78 + after.cx * 0.22,
          highY = upper.cy * 0.78 + after.cy * 0.22;
        let rx =
            (s.rx * 0.78 + upper.rx * 0.22) * (1 - blend) +
            (upper.rx * 0.78 + after.rx * 0.22) * blend -
            inset,
          ry =
            (s.ry * 0.78 + upper.ry * 0.22) * (1 - blend) +
            (upper.ry * 0.78 + after.ry * 0.22) * blend -
            inset;
        const ripple =
          1 +
          (Math.cos(angle * 5 + noise(x, y, 0) * 6.28) * 0.025 +
            Math.sin(angle * 3) * 0.015) *
            (inner ? 0.3 : 1);
        if (inner) {
          rx *= 0.65;
          ry *= 0.65;
        }
        let a =
            lowX * (1 - blend) + highX * blend + Math.cos(angle) * rx * ripple,
          b =
            lowY * (1 - blend) + highY * blend + Math.sin(angle) * ry * ripple;
        return [a, z + h, b];
      };
      const shade = (i: number, inner = false) =>
        inner
          ? 0.38
          : 0.8 + 0.15 * Math.cos((i / segments) * Math.PI * 2 - 2.4);
      for (let j = 0; j + 1 < stops.length; j++)
        for (let i = 0; i < segments; i++)
          for (const inside of hollow ? [false, true] : [false]) {
            const a = contour(i, stops[j], inside),
              b = contour(i, stops[j + 1], inside),
              c = contour(i + 1, stops[j + 1], inside),
              d = contour(i + 1, stops[j], inside);
            // The repeated local material stays at bark scale rather than stretching a cut disk.
            const u = mirror(i / 8),
              u1 = mirror((i + 1) / 8),
              v = mirror((z + stops[j]) / period),
              v1 = mirror((z + stops[j + 1]) / period);
            const q = [
              texturePoint(side, u, v),
              texturePoint(side, u, v1),
              texturePoint(side, u1, v1),
              texturePoint(side, u1, v),
            ];
            if (inside) {
              triangle(
                out,
                [a, c, b],
                [q[0], q[2], q[1]],
                [shade(i, true), shade(i + 1, true), shade(i, true)],
              );
              triangle(
                out,
                [a, d, c],
                [q[0], q[3], q[2]],
                [shade(i, true), shade(i + 1, true), shade(i + 1, true)],
              );
            } else {
              triangle(out, [a, b, c], q.slice(0, 3), [
                shade(i),
                shade(i),
                shade(i + 1),
              ]);
              triangle(
                out,
                [a, c, d],
                [q[0], q[2], q[3]],
                [shade(i), shade(i + 1), shade(i + 1)],
              );
            }
          }
      if (!next)
        for (let i = 0; i < segments; i++) {
          const a = contour(i, 1),
            b = contour(i + 1, 1);
          const coord = (p: Point) =>
            texturePoint(
              top,
              0.5 + (p[0] - s.cx) / (s.rx * 2),
              0.5 - (p[2] - s.cy) / (s.ry * 2),
            );
          if (hollow) {
            const c = contour(i, 1, true),
              d = contour(i + 1, 1, true);
            triangle(
              out,
              [a, c, b],
              [coord(a), coord(c), coord(b)],
              [1, 0.8, 1],
            );
            triangle(
              out,
              [b, c, d],
              [coord(b), coord(c), coord(d)],
              [1, 0.8, 0.8],
            );
          } else
            triangle(
              out,
              [[s.cx, z + 1, s.cy], b, a],
              [texturePoint(top, 0.5, 0.5), coord(b), coord(a)],
              [1, 1, 1],
            );
        }
      if (root && !hollow)
        for (let i = 0; i < segments; i++) {
          const a = contour(i, 0),
            b = contour(i + 1, 0),
            coord = (p: Point) =>
              texturePoint(
                side,
                0.5 + (p[0] - s.cx) / (s.rx * 2),
                0.5 + (p[2] - s.cy) / (s.ry * 2),
              );
          triangle(
            out,
            [[s.cx, z, s.cy], a, b],
            [texturePoint(side, 0.5, 0.5), coord(a), coord(b)],
            [0.65, 0.65, 0.65],
          );
        }
    }
  }
  if (/BRANCH|TWIG|SLOPING/.test(token)) {
    const twig = /TWIG/.test(token),
      sloping = /SLOPING/.test(token),
      succulent = id === "SAGUARO" || hollow,
      radius = sloping
        ? 0.2
        : succulent
          ? twig
            ? 0.11
            : 0.18
          : twig
            ? 0.045
            : 0.105,
      offset = (noise(x, y, z) - 0.5) * 0.1;
    const center: Point = [
      x + 0.5 + offset,
      z + 0.32 + offset,
      y + 0.5 - offset,
    ];
    const letters = /_([NSEW]+)$/.exec(token)?.[1];
    for (const [letter, dx, dy] of [
      ["N", 0, -1],
      ["S", 0, 1],
      ["E", 1, 0],
      ["W", -1, 0],
    ] as const) {
      const n = tileAt(chunks, x + dx, y + dy, z),
        joins = same(t, n),
        stem = joins && trunk(n);
      if (!(
        letters?.includes(letter) ||
        (!letters &&
          joins &&
          topology.linked([x, y, z], [x + dx, y + dy, z])) ||
        stem
      ))
        continue;
      const ex = x + 0.5 + dx * 0.5,
        ey = y + 0.5 + dy * 0.5,
        edgeHeight =
          z +
          0.32 +
          (noise(Math.round(ex * 2), Math.round(ey * 2), z) - 0.5) * 0.1;
      const end: Point = [
        stem ? x + 0.5 + dx : ex,
        edgeHeight,
        stem ? y + 0.5 + dy : ey,
      ];
      const mid: Point = [
        (center[0] + end[0]) / 2,
        (center[1] + end[1]) / 2 + 0.045,
        (center[2] + end[2]) / 2,
      ];
      const edgeRadius = joins
        ? Math.min(radius, /TWIG/.test(n!.treeGraphic!) ? 0.045 : 0.105)
        : 0.018;
      limb(
        out,
        [center, mid, end],
        [radius * 1.15, (radius + edgeRadius) / 2, edgeRadius],
        surface,
        uv,
        12,
      );
    }
    for (const dz of [-1, 1])
      if (
        related(0, 0, dz) &&
        (topology.linked([x, y, z], [x, y, z + dz]) || (sloping && dz < 0))
      ) {
        const end: Point = [
          x + 0.5,
          z + (dz > 0 ? 1 : sloping ? -0.16 : 0),
          y + 0.5,
        ];
        const base = trunk(tileAt(chunks, x, y, z + dz))
          ? sloping
            ? 0.33
            : 0.18
          : radius;
        limb(
          out,
          [
            center,
            [
              (center[0] + end[0]) / 2,
              (center[1] + end[1]) / 2,
              (center[2] + end[2]) / 2,
            ],
            end,
          ],
          [radius * 1.25, (radius + base) / 2, base],
          surface,
          uv,
          12,
        );
      }
    if (
      twig &&
      !/DEAD|LEAFLESS/.test(token) &&
      t.tree?.leaves &&
      !/GLUMPRONG|BLOOD_THORN|SPORE_TREE|SAGUARO|TUNNEL_TUBE/.test(id)
    ) {
      for (const [dx, dy] of [
        [-0.25, -0.22],
        [0.24, -0.23],
        [-0.22, 0.24],
        [0.24, 0.23],
      ])
        limb(
          out,
          [center, [x + 0.5 + dx, z + 0.53 + offset, y + 0.5 + dy]],
          [0.035, 0.012],
          surface,
          uv,
          8,
        );
    }
    if (twig && succulent && !/DEAD|LEAFLESS/.test(token)) {
      const segments = 20,
        outer = 0.22,
        inner = 0.14,
        bottom = z + 0.29,
        top = z + 0.72,
        rect = uv(surface),
        cut = uv(t.tree?.bark),
        green = uv(crop(t.tree?.cap, 10 / 32, 10 / 32, 12 / 32, 12 / 32));
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2,
          b = ((i + 1) / segments) * Math.PI * 2;
        const point = (a: number, h: number, r: number): Point => [
          x + 0.5 + Math.cos(a) * r,
          h,
          y + 0.5 + Math.sin(a) * r,
        ];
        const p = point(a, bottom, outer * 0.8),
          q = point(a, top, outer),
          r = point(b, top, outer),
          s = point(b, bottom, outer * 0.8),
          c0 = texturePoint(rect, 0, 0),
          c1 = texturePoint(rect, 0, 1),
          c2 = texturePoint(rect, 1, 1),
          c3 = texturePoint(rect, 1, 0),
          shade = 0.8 + 0.12 * Math.cos(a - 2.4);
        triangle(out, [p, q, r], [c0, c1, c2], [shade, shade, shade]);
        triangle(out, [p, r, s], [c0, c2, c3], [shade, shade, shade]);
        const capUV = (a: number, r: number) =>
          texturePoint(
            cut,
            0.5 + ((Math.cos(a) * r) / outer) * 0.44,
            0.5 - ((Math.sin(a) * r) / outer) * 0.44,
          );
        if (hollow) {
          const u = point(a, top, inner),
            v = point(b, top, inner),
            low = point(a, bottom, inner),
            low1 = point(b, bottom, inner);
          triangle(
            out,
            [q, u, r],
            [capUV(a, outer), capUV(a, inner), capUV(b, outer)],
            [1, 0.8, 1],
          );
          triangle(
            out,
            [r, u, v],
            [capUV(b, outer), capUV(a, inner), capUV(b, inner)],
            [1, 0.8, 0.8],
          );
          triangle(out, [u, low, v], [c1, c0, c2], [0.48, 0.2, 0.48]);
          triangle(out, [v, low, low1], [c2, c0, c3], [0.48, 0.2, 0.2]);
        } else
          for (let j = 0; j < 6; j++) {
            const low = ((j / 6) * Math.PI) / 2,
              high = (((j + 1) / 6) * Math.PI) / 2;
            const dome = (angle: number, bend: number): Point =>
              point(angle, top + Math.sin(bend) * 0.2, Math.cos(bend) * outer);
            const aa = dome(a, low),
              bb = dome(a, high),
              cc = dome(b, high),
              dd = dome(b, low),
              coords = (p: Point) =>
                texturePoint(
                  green,
                  0.5 + (p[0] - x - 0.5) / (outer * 2),
                  0.5 + (p[2] - y - 0.5) / (outer * 2),
                );
            triangle(
              out,
              [aa, bb, dd],
              [coords(aa), coords(bb), coords(dd)],
              [0.9, 0.94, 0.9],
            );
            if (j < 5)
              triangle(
                out,
                [bb, cc, dd],
                [coords(bb), coords(cc), coords(dd)],
                [0.94, 0.94, 0.9],
              );
          }
      }
    }
  }
}
