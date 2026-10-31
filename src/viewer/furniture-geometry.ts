import type { SceneryObject, SpriteRef } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";

export type Point = [number, number, number];
export type Region = [number, number, number, number];
export function furnitureCrop(ref: SpriteRef, [x, y, w, h]: Region): SpriteRef {
  return {
    ...ref,
    x: ref.x + (x * ref.width) / 32,
    y: ref.y + (y * ref.height) / 32,
    width: (w * ref.width) / 32,
    height: (h * ref.height) / 32,
  };
}

/** Native material texels remain the same size on a leg, rim and broad panel. */
export class FurnitureGeometry {
  faces: FurnitureFace[] = [];
  constructor(
    readonly object: SceneryObject,
    readonly ground: number,
  ) {}
  crop(region: Region, ref = this.object.sprite!) {
    return furnitureCrop(ref, region);
  }
  face(
    p: Point[],
    skin?: SpriteRef,
    shade = 1,
    tint?: [number, number, number],
    fit = false,
    palette = this.object.palette,
    offset: [number, number] = [0, 0],
  ) {
    const emit = (points: Point[], uv?: number[]) =>
      this.faces.push({
        positions: points.flatMap(([x, y, z]) => [
          this.object.x + x,
          this.ground + y,
          this.object.y + z,
        ]),
        sprite: skin,
        brightness: shade,
        tint,
        palette: skin ? palette : undefined,
        ...(uv ? { uvs: uv } : {}),
      });
    if (!skin) {
      emit(p);
      return;
    }
    const uv = (u: number, v: number) => [
      (skin.x + u) / skin.pageWidth,
      1 - (skin.y + v) / skin.pageHeight,
    ];
    if (fit) {
      emit(p, [
        ...uv(0.25, 0.25),
        ...uv(0.25, skin.height - 0.25),
        ...uv(skin.width - 0.25, skin.height - 0.25),
        ...uv(skin.width - 0.25, 0.25),
      ]);
      return;
    }
    const length = (a: Point, b: Point) =>
      Math.hypot(...a.map((x, i) => x - b[i]));
    const w = skin.width === 1 ? 1 : Math.max(0.001, length(p[0], p[3]) * 32),
      h = skin.height === 1 ? 1 : Math.max(0.001, length(p[0], p[1]) * 32);
    const tw = Math.max(1, skin.width),
      th = Math.max(1, skin.height),
      [ox, oy] = [
        skin.width === 1 ? 0 : offset[0],
        skin.height === 1 ? 0 : offset[1],
      ];
    const point = (u: number, v: number): Point =>
      p[0].map(
        (x, i) =>
          (x + (p[3][i] - x) * u) * (1 - v) +
          (p[1][i] + (p[2][i] - p[1][i]) * u) * v,
      ) as Point;
    for (let iy = Math.floor(oy / th); iy < Math.ceil((oy + h) / th); iy++)
      for (let ix = Math.floor(ox / tw); ix < Math.ceil((ox + w) / tw); ix++) {
        const a = Math.max(ox, ix * tw),
          b = Math.min(ox + w, (ix + 1) * tw),
          c = Math.max(oy, iy * th),
          d = Math.min(oy + h, (iy + 1) * th);
        const x = (u: number) => 0.25 + ((u - ix * tw) / tw) * (tw - 0.5),
          y = (v: number) => 0.25 + ((v - iy * th) / th) * (th - 0.5);
        emit(
          [
            point((a - ox) / w, (c - oy) / h),
            point((a - ox) / w, (d - oy) / h),
            point((b - ox) / w, (d - oy) / h),
            point((b - ox) / w, (c - oy) / h),
          ],
          [
            ...uv(x(a), y(c)),
            ...uv(x(a), y(d)),
            ...uv(x(b), y(d)),
            ...uv(x(b), y(c)),
          ],
        );
      }
  }
  box(
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    skin?: SpriteRef,
    tint?: [number, number, number],
    verticalGrain = false,
  ) {
    this.face(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      skin,
      1,
      tint,
    );
    this.face(
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      skin,
      0.62,
      tint,
    );
    const side = (p: Point[], shade: number) =>
      this.face(
        verticalGrain ? [p[3], p[0], p[1], p[2]] : p,
        skin,
        shade,
        tint,
      );
    side(
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      0.88,
    );
    side(
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      0.76,
    );
    side(
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      0.8,
    );
    side(
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
      0.93,
    );
  }
  beam(a: Point, b: Point, r: number, skin?: SpriteRef) {
    const d = b.map((v, i) => v - a[i]) as Point,
      len = Math.hypot(...d);
    if (len < 0.00001) return;
    const n = d.map((v) => v / len) as Point;
    const cross = (u: Point, v: Point): Point => [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const q = cross(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
      size = Math.hypot(...q),
      u = q.map((v) => (v / size) * r) as Point,
      v = cross(n, u);
    const ring = (p: Point) =>
        [
          [1, 1],
          [-1, 1],
          [-1, -1],
          [1, -1],
        ].map(([x, y]) => p.map((c, i) => c + x * u[i] + y * v[i]) as Point),
      lo = ring(a),
      hi = ring(b);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.face([hi[i], lo[i], lo[j], hi[j]], skin, 0.82 + i * 0.045);
    }
    this.face(hi, skin);
    this.face(lo, skin, 0.7);
  }
  lathe(
    profile: [number, number][],
    skin?: SpriteRef,
    tint?: [number, number, number],
    n = 16,
  ) {
    let distance = 0;
    for (let j = 0; j < profile.length - 1; j++) {
      const [r, y] = profile[j],
        [R, Y] = profile[j + 1],
        height = Math.hypot(R - r, Y - y);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2,
          b = ((i + 1) / n) * Math.PI * 2;
        this.face(
          [
            [0.5 + Math.cos(a) * r, y, 0.5 + Math.sin(a) * r],
            [0.5 + Math.cos(a) * R, Y, 0.5 + Math.sin(a) * R],
            [0.5 + Math.cos(b) * R, Y, 0.5 + Math.sin(b) * R],
            [0.5 + Math.cos(b) * r, y, 0.5 + Math.sin(b) * r],
          ],
          skin,
          Math.abs(Y - y) < 1e-9
            ? R < r
              ? 1
              : 0.62
            : 0.78 + 0.22 * Math.max(0, Math.cos(a - 0.7)),
          tint,
          false,
          this.object.palette,
          [(i / n) * 2 * Math.PI * Math.max(r, R) * 32, distance * 32],
        );
      }
      distance += height;
    }
  }
}
