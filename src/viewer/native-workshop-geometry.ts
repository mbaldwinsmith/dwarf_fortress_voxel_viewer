import type { SceneryObject, SpriteRef } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";
import type { NativeWorkshopPixels } from "./native-workshop-relief.js";

export type Rect = [number, number, number, number];
export type Point = [number, number, number];
export interface NativeSkin {
  ref: SpriteRef;
  rect: Rect;
  palette?: SceneryObject["palette"];
}

/** Small physical primitives. All UVs address the user's locally loaded art. */
export class NativeWorkshopGeometry {
  faces: FurnitureFace[] = [];
  constructor(
    readonly object: SceneryObject,
    readonly pixels: NativeWorkshopPixels,
  ) {}

  skin(rect: Rect, base = false): NativeSkin {
    const art = this.object.workshop!.art!;
    return {
      ref: base ? art.base : (art.decor ?? art.base),
      rect,
      ...(base ? { palette: this.object.palette } : {}),
    };
  }

  /** Find an opaque interior patch inside a material-only source region. */
  patch(
    rect: Rect,
    base = false,
    tone?: "wood" | "stone" | "dark",
  ): NativeSkin {
    const data = base
      ? this.pixels.base
      : (this.pixels.decor ?? this.pixels.base);
    const width = this.pixels.width;
    const rows = new Uint16Array(width + 1);
    let best = 0;
    let found: Rect = rect;
    const left = Math.max(0, Math.ceil(rect[0])),
      right = Math.min(width, Math.floor(rect[2]));
    for (
      let y = Math.max(0, Math.ceil(rect[1]));
      y < Math.min(this.pixels.height, Math.floor(rect[3]));
      y++
    ) {
      for (let x = left; x < right; x++) {
        const k = (y * width + x) * 4;
        const matches =
          !tone ||
          (tone === "wood"
            ? data[k] > data[k + 1] * 1.13 && data[k + 1] > data[k + 2] * 1.1
            : tone === "dark"
              ? data[k] + data[k + 1] + data[k + 2] < 250
              : Math.abs(data[k] - data[k + 1]) < 14 &&
                Math.abs(data[k + 1] - data[k + 2]) < 14);
        rows[x] = data[k + 3] > 240 && matches ? rows[x] + 1 : 0;
      }
      const stack: number[] = [];
      for (let x = left; x <= right; x++) {
        const h = x < right ? rows[x] : 0;
        while (stack.length && rows[stack[stack.length - 1]] > h) {
          const height = rows[stack.pop()!],
            a = stack.length ? stack[stack.length - 1] + 1 : left;
          if (height * (x - a) > best) {
            best = height * (x - a);
            found = [a, y - height + 1, x, y + 1];
          }
        }
        stack.push(x);
      }
    }
    // Stay inside texel centres so linear filtering cannot bleed transparent borders.
    if (!best && tone) return this.patch(rect, base);
    return this.skin(
      [found[0] + 0.25, found[1] + 0.25, found[2] - 0.25, found[3] - 0.25],
      base,
    );
  }

  face(points: Point[], skin: NativeSkin, shade = 1, coords?: number[]) {
    const {
      ref,
      rect: [x, y, X, Y],
      palette,
    } = skin;
    this.faces.push({
      positions: points.flat(),
      sprite: ref,
      palette,
      brightness: shade,
      uvs: (coords ?? [x, y, x, Y, X, Y, X, y]).map((v, i) =>
        i % 2 ? 1 - (ref.y + v) / ref.pageHeight : (ref.x + v) / ref.pageWidth,
      ),
    });
  }

  projected(
    points: Point[],
    skin: NativeSkin,
    bounds: Rect,
    axes: [number, number] = [0, 1],
    shade = 1,
  ) {
    const [x, y, X, Y] = skin.rect,
      [a, b, A, B] = bounds;
    this.face(
      points,
      skin,
      shade,
      points.flatMap((p) => [
        x + ((X - x) * (p[axes[0]] - a)) / (A - a),
        Y - ((Y - y) * (p[axes[1]] - b)) / (B - b),
      ]),
    );
  }

  /** Repeat a local material crop at native texel density without atlas bleeding. */
  tiled(points: Point[], skin: NativeSkin, coords: number[], shade = 1) {
    type Vertex = { p: Point; u: number; v: number };
    const polygon = points.map((p, i) => ({
      p,
      u: coords[i * 2],
      v: coords[i * 2 + 1],
    }));
    const [x, y, X, Y] = skin.rect,
      tw = X - x,
      th = Y - y;
    const clip = (
      input: Vertex[],
      axis: "u" | "v",
      edge: number,
      greater: boolean,
    ) => {
      const result: Vertex[] = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i],
          b = input[(i + 1) % input.length];
        const inside = (p: Vertex) =>
          greater ? p[axis] >= edge - 1e-8 : p[axis] <= edge + 1e-8;
        if (inside(a)) result.push(a);
        if (inside(a) !== inside(b)) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          result.push({
            p: a.p.map((v, k) => v + (b.p[k] - v) * t) as Point,
            u: a.u + (b.u - a.u) * t,
            v: a.v + (b.v - a.v) * t,
          });
        }
      }
      return result;
    };
    const u0 = Math.floor(Math.min(...polygon.map((p) => p.u)) / tw),
      u1 = Math.floor(Math.max(...polygon.map((p) => p.u)) / tw);
    const v0 = Math.floor(Math.min(...polygon.map((p) => p.v)) / th),
      v1 = Math.floor(Math.max(...polygon.map((p) => p.v)) / th);
    for (let u = u0; u <= u1; u++)
      for (let v = v0; v <= v1; v++) {
        let piece = clip(polygon, "u", u * tw, true);
        piece = clip(piece, "u", (u + 1) * tw, false);
        piece = clip(piece, "v", v * th, true);
        piece = clip(piece, "v", (v + 1) * th, false);
        for (let i = 1; i < piece.length - 1; i++) {
          const triangle = [piece[0], piece[i], piece[i + 1], piece[i + 1]];
          this.face(
            triangle.map((p) => p.p),
            skin,
            shade,
            triangle.flatMap((p) => [x + p.u - u * tw, y + p.v - v * th]),
          );
        }
      }
  }

  /** Alpha-shaped thin parts (hanging cloth, saws, bows), with real edge depth. */
  decal(rect: Rect, bounds: Rect, height: number) {
    const data = this.pixels.decor ?? this.pixels.base,
      W = this.pixels.width;
    const [x, y, X, Y] = rect,
      [a, b, A, B] = bounds;
    const point = (u: number, v: number): Point => [
      a + ((A - a) * (u - x)) / (X - x),
      height,
      b + ((B - b) * (v - y)) / (Y - y),
    ];
    for (let u = x; u < X; u++)
      for (let v = y; v < Y; v++)
        if (data[(v * W + u) * 4 + 3] > 100) {
          let V = v + 1;
          while (V < Y && data[(V * W + u) * 4 + 3] > 100) V++;
          this.face(
            [point(u, v), point(u, V), point(u + 1, V), point(u + 1, v)],
            this.skin([u, v, u + 1, V]),
          );
          v = V - 1;
        }
  }

  cutout(
    rect: Rect,
    center: Point,
    width: number,
    height: number,
    depth = 0.025,
    accept?: (r: number, g: number, b: number) => boolean,
  ) {
    const data = this.pixels.decor ?? this.pixels.base,
      W = this.pixels.width;
    const [x, y, X, Y] = rect;
    const opaque = (a: number, b: number) =>
      a >= x &&
      a < X &&
      b >= y &&
      b < Y &&
      data[(b * W + a) * 4 + 3] > 100 &&
      (!accept ||
        accept(
          data[(b * W + a) * 4],
          data[(b * W + a) * 4 + 1],
          data[(b * W + a) * 4 + 2],
        ));
    const point = (a: number, b: number, z: number): Point => [
      center[0] + ((a - x) / (X - x) - 0.5) * width,
      center[1] + (height * (Y - b)) / (Y - y),
      center[2] + z,
    ];
    for (let b = y; b < Y; b++)
      for (let a = x; a < X; a++)
        if (opaque(a, b)) {
          const skin = this.skin([a + 0.1, b + 0.1, a + 0.9, b + 0.9]);
          this.face(
            [
              point(a, b, depth / 2),
              point(a, b + 1, depth / 2),
              point(a + 1, b + 1, depth / 2),
              point(a + 1, b, depth / 2),
            ],
            skin,
          );
          this.face(
            [
              point(a + 1, b, -depth / 2),
              point(a + 1, b + 1, -depth / 2),
              point(a, b + 1, -depth / 2),
              point(a, b, -depth / 2),
            ],
            skin,
            0.85,
          );
          if (!opaque(a - 1, b))
            this.face(
              [
                point(a, b, -depth / 2),
                point(a, b + 1, -depth / 2),
                point(a, b + 1, depth / 2),
                point(a, b, depth / 2),
              ],
              skin,
              0.8,
            );
          if (!opaque(a + 1, b))
            this.face(
              [
                point(a + 1, b, depth / 2),
                point(a + 1, b + 1, depth / 2),
                point(a + 1, b + 1, -depth / 2),
                point(a + 1, b, -depth / 2),
              ],
              skin,
              0.8,
            );
          if (!opaque(a, b - 1))
            this.face(
              [
                point(a, b, -depth / 2),
                point(a, b, depth / 2),
                point(a + 1, b, depth / 2),
                point(a + 1, b, -depth / 2),
              ],
              skin,
            );
          if (!opaque(a, b + 1))
            this.face(
              [
                point(a, b + 1, depth / 2),
                point(a, b + 1, -depth / 2),
                point(a + 1, b + 1, -depth / 2),
                point(a + 1, b + 1, depth / 2),
              ],
              skin,
              0.7,
            );
        }
  }

  box(a: Point, b: Point, skin: NativeSkin, top = skin, front = skin) {
    const [x, y, z] = a,
      [X, Y, Z] = b;
    this.face(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      top,
    );
    this.face(
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      skin,
      0.65,
    );
    this.face(
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      front,
      0.96,
    );
    this.face(
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      skin,
      0.8,
    );
    this.face(
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      skin,
      0.78,
    );
    this.face(
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
      skin,
      0.9,
    );
  }

  beam(a: Point, b: Point, radius: number, skin: NativeSkin, sides = 6) {
    const d = b.map((v, i) => v - a[i]),
      l = Math.hypot(...d);
    if (l < 1e-6) return;
    const axis = d.map((v) => v / l);
    const u = Math.abs(axis[1]) < 0.95 ? [axis[2], 0, -axis[0]] : [1, 0, 0];
    const ul = Math.hypot(...u);
    for (let k = 0; k < 3; k++) u[k] /= ul;
    const v = [
      axis[1] * u[2] - axis[2] * u[1],
      axis[2] * u[0] - axis[0] * u[2],
      axis[0] * u[1] - axis[1] * u[0],
    ];
    const p = (c: Point, i: number): Point =>
      c.map(
        (n, k) =>
          n +
          radius *
            (u[k] *
              Math.cos(((i + (sides === 4 ? 0.5 : 0)) * 2 * Math.PI) / sides) +
              v[k] *
                Math.sin(
                  ((i + (sides === 4 ? 0.5 : 0)) * 2 * Math.PI) / sides,
                )),
      ) as Point;
    for (let i = 0; i < sides; i++) {
      this.face([p(a, i), p(b, i), p(b, i + 1), p(a, i + 1)], skin, 0.88);
      this.face([a, p(a, i + 1), p(a, i), a], skin, 0.8);
      this.face([b, p(b, i), p(b, i + 1), b], skin);
    }
  }

  /** A continuous tube has shared bend rings and no overlapping internal caps. */
  tube(path: Point[], radius: number, skin: NativeSkin, sides = 12) {
    if (path.length < 2) return;
    let distance = 0;
    const rings = path.map((p, i) => {
      const before = path[Math.max(0, i - 1)],
        after = path[Math.min(path.length - 1, i + 1)];
      const delta = after.map((v, k) => v - before[k]),
        length = Math.hypot(...delta);
      const axis = delta.map((v) => v / length);
      const seed = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const dot = seed.reduce((s, v, k) => s + v * axis[k], 0);
      const u = seed.map((v, k) => v - dot * axis[k]),
        ul = Math.hypot(...u);
      for (let k = 0; k < 3; k++) u[k] /= ul;
      const v = [
        axis[1] * u[2] - axis[2] * u[1],
        axis[2] * u[0] - axis[0] * u[2],
        axis[0] * u[1] - axis[1] * u[0],
      ];
      if (i) distance += Math.hypot(...p.map((x, k) => x - path[i - 1][k]));
      return {
        distance,
        points: Array.from(
          { length: sides },
          (_, j) =>
            p.map(
              (x, k) =>
                x +
                radius *
                  (u[k] * Math.cos((j * 2 * Math.PI) / sides) +
                    v[k] * Math.sin((j * 2 * Math.PI) / sides)),
            ) as Point,
        ),
      };
    });
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < sides; j++) {
        const a = rings[i],
          b = rings[i + 1],
          next = (j + 1) % sides;
        const low = (j * 2 * Math.PI * radius * 32) / sides,
          high = ((j + 1) * 2 * Math.PI * radius * 32) / sides;
        this.tiled(
          [a.points[j], b.points[j], b.points[next], a.points[next]],
          skin,
          [
            a.distance * 32,
            low,
            b.distance * 32,
            low,
            b.distance * 32,
            high,
            a.distance * 32,
            high,
          ],
          0.9,
        );
      }
    const [x, y, X, Y] = skin.rect;
    const uv = (a: number) => [
      (x + X) / 2 + Math.cos(a) * (X - x) * 0.48,
      (y + Y) / 2 + Math.sin(a) * (Y - y) * 0.48,
    ];
    for (const i of [0, path.length - 1])
      for (let j = 0; j < sides; j++)
        this.face(
          [
            path[i],
            rings[i].points[j],
            rings[i].points[(j + 1) % sides],
            path[i],
          ],
          skin,
          0.85,
          [
            (x + X) / 2,
            (y + Y) / 2,
            ...uv((j * 2 * Math.PI) / sides),
            ...uv(((j + 1) * 2 * Math.PI) / sides),
            (x + X) / 2,
            (y + Y) / 2,
          ],
        );
  }

  table(
    bounds: Rect,
    height: number,
    top: NativeSkin,
    wood: NativeSkin,
    thickness = 0.045,
  ) {
    const [x, z, X, Z] = bounds;
    this.box([x, height - thickness, z], [X, height, Z], wood, top);
    for (const a of [x + 0.045, X - 0.11])
      for (const b of [z + 0.045, Z - 0.11])
        this.box([a, 0, b], [a + 0.065, height - thickness, b + 0.065], wood);
  }

  /** Radial profile: separate lid/mouth and side strips, never a whole sprite on every side. */
  lathe(
    center: Point,
    radius: number,
    height: number,
    body: NativeSkin,
    cap: NativeSkin,
    kind:
      | "barrel"
      | "open"
      | "sack"
      | "stone"
      | "bowl"
      | "still"
      | "spool"
      | "rock"
      | "crystal"
      | "pail"
      | "pipe"
      | "vat"
      | "jug" = "barrel",
    horizontal = false,
    capTiled: boolean | number = false,
  ) {
    const profiles: Record<typeof kind, [number, number][]> = {
      pipe: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0.68, 1],
        [0.68, 0.5],
        [0, 0.5],
      ],
      pail: [
        [0, 0],
        [0.6, 0],
        [0.73, 0.5],
        [0.94, 1],
        [0.79, 1],
        [0.64, 0.77],
        [0, 0.77],
      ],
      vat: [
        [0, 0],
        [0.64, 0],
        [1, 0.3],
        [1, 0.64],
        [0.8, 0.94],
        [0.77, 1],
        [0.64, 1],
        [0.64, 0.78],
        [0, 0.78],
      ],
      barrel: [
        [0, 0],
        [0.83, 0],
        [0.98, 0.15],
        [1, 0.5],
        [0.96, 0.85],
        [0.84, 1],
        [0, 1],
      ],
      open: [
        [0, 0],
        [0.82, 0],
        [1, 0.22],
        [1, 0.86],
        [0.9, 1],
        [0.76, 1],
        [0.75, 0.76],
        [0, 0.76],
      ],
      sack: [
        [0, 0],
        [0.65, 0],
        [1, 0.25],
        [0.95, 0.65],
        [0.65, 0.86],
        [0.23, 0.92],
        [0.3, 1],
        [0, 1],
      ],
      stone: [
        [0, 0],
        [0.94, 0],
        [1, 0.08],
        [1, 0.87],
        [0.92, 1],
        [0, 1],
      ],
      bowl: [
        [0, 0],
        [0.5, 0],
        [0.92, 0.65],
        [1, 1],
        [0.83, 1],
        [0.7, 0.4],
        [0, 0.3],
      ],
      still: [
        [0, 0],
        [0.85, 0],
        [1, 0.06],
        [1, 0.5],
        [0.85, 0.56],
        [0.22, 0.74],
        [0.22, 1],
        [0, 1],
      ],
      spool: [
        [0, 0],
        [1, 0],
        [1, 0.12],
        [0.58, 0.16],
        [0.58, 0.85],
        [1, 0.88],
        [1, 1],
        [0, 1],
      ],
      jug: [
        [0, 0],
        [0.65, 0],
        [1, 0.2],
        [1, 0.5],
        [0.5, 0.75],
        [0.3, 0.88],
        [0.35, 1],
        [0.2, 1],
        [0.18, 0.85],
        [0, 0.85],
      ],
      rock: [
        [0, 0],
        [0.8, 0],
        [1, 0.25],
        [0.9, 0.7],
        [0.35, 1],
        [0, 1],
      ],
      crystal: [
        [0, 0],
        [0.7, 0],
        [1, 0.23],
        [0.7, 0.75],
        [0, 1],
      ],
    };
    const profile = profiles[kind],
      n = kind === "rock" || kind === "crystal" ? 7 : 20;
    const point = (r: number, h: number, a: number): Point =>
      horizontal
        ? [
            center[0] + Math.cos(a) * r * radius,
            center[1] + Math.sin(a) * r * radius,
            center[2] + h * height,
          ]
        : [
            center[0] + Math.cos(a) * r * radius,
            center[1] + h * height,
            center[2] + Math.sin(a) * r * radius,
          ];
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const [r, h] = profile[j],
          [R, H] = profile[j + 1],
          a = (i * 2 * Math.PI) / n,
          b = ((i + 1) * 2 * Math.PI) / n;
        const points = [
          point(r, h, a),
          point(r, h, b),
          point(R, H, b),
          point(R, H, a),
        ];
        const flat = r === 0 || R === 0 || h === H;
        const skin = flat ? cap : body,
          [x, y, X, Y] = skin.rect;
        const coords = flat
          ? points.flatMap((p) => [
              x + (X - x) * (0.5 + (0.48 * (p[0] - center[0])) / radius),
              y +
                (Y - y) *
                  (0.5 +
                    (0.48 *
                      (p[horizontal ? 1 : 2] - center[horizontal ? 1 : 2])) /
                      radius),
            ])
          : [
              [a, h],
              [b, h],
              [b, H],
              [a, H],
            ].flatMap(([angle, t]) => [
              x + (X - x) * (0.5 + 0.48 * Math.cos(angle)),
              Y - (Y - y) * t,
            ]);
        if (flat && capTiled) {
          const scale = typeof capTiled === "number" ? capTiled : 32;
          this.tiled(
            points,
            skin,
            points.flatMap((p) => [
              (p[0] - center[0] + radius) * scale,
              (p[horizontal ? 1 : 2] - center[horizontal ? 1 : 2] + radius) *
                scale,
            ]),
          );
        } else
          this.face(
            points,
            skin,
            j > profile.length - 4 && kind === "open" ? 0.75 : 0.9,
            coords,
          );
      }
  }

  wheel(
    center: Point,
    radius: number,
    skin: NativeSkin,
    depth = 0.07,
    spokes = 8,
  ) {
    const [x, y, z] = center,
      inner = radius * 0.8,
      n = 24;
    const point = (r: number, i: number, Z: number): Point => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      y + r * Math.sin((i * 2 * Math.PI) / n),
      Z,
    ];
    for (let i = 0; i < n; i++) {
      for (const Z of [z - depth / 2, z + depth / 2])
        this.projected(
          [
            point(radius, i, Z),
            point(inner, i, Z),
            point(inner, i + 1, Z),
            point(radius, i + 1, Z),
          ],
          skin,
          [x - radius, y - radius, x + radius, y + radius],
        );
      this.face(
        [
          point(radius, i, z - depth / 2),
          point(radius, i, z + depth / 2),
          point(radius, i + 1, z + depth / 2),
          point(radius, i + 1, z - depth / 2),
        ],
        skin,
        0.85,
      );
      this.face(
        [
          point(inner, i + 1, z - depth / 2),
          point(inner, i + 1, z + depth / 2),
          point(inner, i, z + depth / 2),
          point(inner, i, z - depth / 2),
        ],
        skin,
        0.75,
      );
    }
    for (let i = 0; i < spokes; i++)
      this.beam(
        center,
        [
          x + inner * Math.cos((i * 2 * Math.PI) / spokes),
          y + inner * Math.sin((i * 2 * Math.PI) / spokes),
          z,
        ],
        0.022,
        skin,
        4,
      );
    this.beam([x, y, z - depth], [x, y, z + depth], radius * 0.17, skin);
  }
}
