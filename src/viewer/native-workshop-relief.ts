import type { SceneryObject, SpriteRef } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";
export interface NativeWorkshopPixels {
  width: number;
  height: number;
  base: Uint8ClampedArray;
  decor?: Uint8ClampedArray;
  background?: Uint8ClampedArray;
}
interface Component {
  pixels: number[];
  x: number;
  y: number;
  X: number;
  Y: number;
}
function components(
  mask: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const seen = new Uint8Array(mask.length),
    out: Component[] = [];
  for (let i = 0; i < mask.length; i++)
    if (mask[i] && !seen[i]) {
      const pixels = [i];
      seen[i] = 1;
      let x = width,
        y = height,
        X = 0,
        Y = 0;
      for (let n = 0; n < pixels.length; n++) {
        const j = pixels[n],
          cx = j % width,
          cy = Math.floor(j / width);
        x = Math.min(x, cx);
        X = Math.max(X, cx);
        y = Math.min(y, cy);
        Y = Math.max(Y, cy);
        for (const dx of [-1, 0, 1])
          for (const dy of [-1, 0, 1])
            if (
              Math.abs(dx) + Math.abs(dy) === 1 &&
              cx + dx >= 0 &&
              cx + dx < width &&
              cy + dy >= 0 &&
              cy + dy < height
            ) {
              const k = j + dy * width + dx;
              if (mask[k] && !seen[k]) {
                seen[k] = 1;
                pixels.push(k);
              }
            }
      }
      out.push({ pixels, x, y, X, Y });
    }
  return out;
}
export function nativeWorkshopRelief(
  o: SceneryObject,
  data: NativeWorkshopPixels,
): FurnitureFace[] {
  const w = o.workshop!,
    art = w.art;
  if (!art) return [];
  const W = data.width,
    H = data.height,
    faces: FurnitureFace[] = [],
    counters: { x: number; z: number; X: number; Z: number; height: number }[] =
      [];
  const emit = (
    points: number[][],
    ref: SpriteRef,
    coords: number[],
    shade = 1,
    palette = false,
  ) =>
    faces.push({
      positions: points.flat(),
      sprite: ref,
      uvs: coords,
      brightness: shade,
      ...(palette ? { palette: o.palette } : {}),
    });
  const uv = (r: SpriteRef, x: number, y: number, X: number, Y: number) =>
    [x, y, x, Y, X, Y, X, y].map((v, i) =>
      i % 2 ? 1 - (r.y + v) / r.pageHeight : (r.x + v) / r.pageWidth,
    );
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    ref: SpriteRef,
    coords: number[],
    palette = false,
  ) => {
    for (const points of [
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
    ])
      emit(points, ref, coords, 0.9, palette);
  };
  const colour = (
    c: Component,
    pixels: Uint8ClampedArray,
  ): [number, number, number] => {
    const sum = [0, 0, 0];
    let n = 0;
    for (const i of c.pixels) {
      const j = i * 4;
      if (pixels[j] + pixels[j + 1] + pixels[j + 2] < 100) continue;
      for (let k = 0; k < 3; k++) sum[k] += pixels[j + k];
      n++;
    }
    return sum.map((v) => Math.round(v / Math.max(1, n))) as [
      number,
      number,
      number,
    ];
  };
  const textured = (
    points: number[][],
    ref: SpriteRef,
    coords: number[],
    rgb: [number, number, number],
    shade = 1,
    palette = false,
    center?: number[],
  ) => {
    faces.push({ positions: points.flat(), tint: rgb, brightness: shade });
    const a = points[0];
    let n = [0, 0, 0];
    for (const [b, c] of [
      [1, 2],
      [1, 3],
      [2, 3],
    ]) {
      const u = points[b].map((v, k) => v - a[k]),
        v = points[c].map((z, k) => z - a[k]);
      n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      if (Math.hypot(...n) > 1e-9) break;
    }
    if (
      center &&
      n.reduce(
        (s, v, k) =>
          s + v * (points.reduce((t, p) => t + p[k], 0) / 4 - center[k]),
        0,
      ) < 0
    )
      n = n.map((v) => -v);
    const l = Math.hypot(...n) || 1;
    emit(
      points.map((p) => p.map((x, k) => x + (n[k] / l) * 0.0004)),
      ref,
      coords,
      shade,
      palette,
    );
  };
  const sub = (
    c: Component,
    x: number,
    y: number,
    X: number,
    Y: number,
  ): Component | undefined => {
    const pixels = c.pixels.filter(
      (i) =>
        i % W >= x &&
        i % W <= X &&
        Math.floor(i / W) >= y &&
        Math.floor(i / W) <= Y,
    );
    if (!pixels.length) return;
    return {
      pixels,
      x: Math.min(...pixels.map((i) => i % W)),
      X: Math.max(...pixels.map((i) => i % W)),
      y: Math.min(...pixels.map((i) => Math.floor(i / W))),
      Y: Math.max(...pixels.map((i) => Math.floor(i / W))),
    };
  };
  // A fully opaque native interior patch covers inferred sides. Sampling the
  // transparent silhouette margin would expose a featureless solid backing.
  const patch = (c: Component, pixels: Uint8ClampedArray, ref: SpriteRef) => {
    const row = new Uint16Array(W + 1);
    let size = 0,
      px = c.x,
      py = c.y;
    for (let y = c.y; y <= c.Y; y++) {
      let previous = 0;
      for (let x = c.x; x <= c.X; x++) {
        const above = row[x + 1];
        row[x + 1] =
          pixels[(y * W + x) * 4 + 3] > 240
            ? Math.min(above, row[x], previous) + 1
            : 0;
        previous = above;
        if (row[x + 1] > size) {
          size = row[x + 1];
          px = x - size + 1;
          py = y - size + 1;
        }
      }
    }
    return uv(ref, px, py, px + Math.max(1, size), py + Math.max(1, size));
  };
  const nativeBox = (
    c: Component,
    pixels: Uint8ClampedArray,
    ref: SpriteRef,
    y0 = 0,
    height?: number,
  ) => {
    const bw = c.X - c.x + 1,
      bh = c.Y - c.y + 1,
      x = c.x / 32,
      X = (c.X + 1) / 32,
      h = height ?? Math.min(0.8 - y0, (bh / 32) * 0.45),
      depth = Math.min(0.65, Math.max(0.25, h * 0.9));
    const Z = Math.min(
        w.depth - 0.025,
        Math.max(depth + 0.025, (c.Y + 1 - 32) / 32 + 0.06),
      ),
      z = Z - depth,
      Y = y0 + h,
      rgb = colour(c, pixels);
    const front = uv(ref, c.x, c.y + bh * 0.23, c.X + 1, c.Y + 1),
      top = uv(ref, c.x, c.y + 1, c.X + 1, c.y + Math.max(3, bh * 0.3)),
      side = patch(c, pixels, ref);
    textured(
      [
        [x, Y, Z],
        [x, y0, Z],
        [X, y0, Z],
        [X, Y, Z],
      ],
      ref,
      front,
      rgb,
      1,
    );
    textured(
      [
        [X, Y, z],
        [X, y0, z],
        [x, y0, z],
        [x, Y, z],
      ],
      ref,
      front,
      rgb,
      0.85,
    );
    textured(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      ref,
      top,
      rgb,
    );
    textured(
      [
        [x, Y, z],
        [x, y0, z],
        [x, y0, Z],
        [x, Y, Z],
      ],
      ref,
      side,
      rgb,
      0.8,
    );
    textured(
      [
        [X, Y, Z],
        [X, y0, Z],
        [X, y0, z],
        [X, Y, z],
      ],
      ref,
      side,
      rgb,
      0.9,
    );
    textured(
      [
        [x, y0, Z],
        [x, y0, z],
        [X, y0, z],
        [X, y0, Z],
      ],
      ref,
      side,
      rgb,
      0.5,
    );
  };
  const vessel = (
    c: Component,
    pixels: Uint8ClampedArray,
    ref: SpriteRef,
    options: {
      horizontal?: boolean;
      x?: number;
      z?: number;
      y?: number;
      height?: number;
      radius?: number;
      hole?: boolean;
      still?: boolean;
      top?: [number, number, number, number];
    } = {},
  ) => {
    const bw = c.X - c.x + 1,
      bh = c.Y - c.y + 1,
      r = options.radius ?? Math.min(0.48, bw / 64),
      h = options.height ?? Math.min(0.72, Math.max(0.22, (bh / 32) * 0.48));
    const cx = options.x ?? (c.x + c.X + 1) / 64,
      cz =
        options.z ??
        Math.min(
          w.depth - r - 0.025,
          Math.max(r + 0.025, (c.Y + 1 - 32) / 32 - r * 0.75),
        ),
      y0 = options.y ?? 0,
      rgb = colour(c, pixels);
    const profile = options.still
      ? [
          [0, 0],
          [r * 0.9, 0],
          [r, h * 0.45],
          [r * 0.85, h * 0.6],
          [r * 0.3, h * 0.8],
          [r * 0.24, h],
          [0, h],
        ]
      : options.horizontal
        ? [
            [0, 0],
            [r * 0.85, 0],
            [r, h * 0.1],
            [r, h * 0.9],
            [r * 0.85, h],
            [0, h],
          ]
        : options.hole === false
          ? [
              [0, 0],
              [r * 0.82, 0],
              [r, h * 0.16],
              [r, h * 0.85],
              [r * 0.9, h],
              [0, h],
            ]
          : [
              [0, 0],
              [r * 0.82, 0],
              [r, h * 0.16],
              [r, h * 0.82],
              [r * 0.86, h],
              [r * 0.68, h],
              [r * 0.68, h * 0.82],
              [0, h * 0.82],
            ];
    const p = (R: number, y: number, a: number) =>
      options.horizontal
        ? [cx + Math.cos(a) * R, y0 + Math.sin(a) * R, cz + y]
        : [cx + Math.cos(a) * R, y0 + y, cz + Math.sin(a) * R];
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2,
          b = ((i + 1) / 16) * Math.PI * 2,
          [R, y] = profile[j],
          [S, Y] = profile[j + 1],
          points = [p(R, y, a), p(R, y, b), p(S, Y, b), p(S, Y, a)];
        let coords: number[];
        if (R === 0 || S === 0 || Math.abs(y - Y) < 0.00001) {
          coords = points.flatMap((v) => {
            const u = ((v[0] - cx) / r) * 0.48 + 0.5,
              q = options.horizontal
                ? ((v[1] - y0) / r) * 0.48 + 0.5
                : ((v[2] - cz) / r) * 0.48 + 0.5;
            const top = options.top;
            return [
              (ref.x + (top ? top[0] + u * (top[2] - top[0]) : c.x + u * bw)) /
                ref.pageWidth,
              1 -
                (ref.y +
                  (top
                    ? top[1] + q * (top[3] - top[1])
                    : c.y +
                      (options.horizontal ? 0.46 : 0) * bh +
                      q * bh * (options.horizontal ? 0.52 : 0.32))) /
                  ref.pageHeight,
            ];
          });
        } else {
          const U = (angle: number) =>
            0.1 + (0.5 + 0.5 * Math.cos(angle)) * 0.8;
          coords = [
            [U(a), y],
            [U(b), y],
            [U(b), Y],
            [U(a), Y],
          ].flatMap(([u, t]) => [
            (ref.x + c.x + u * bw) / ref.pageWidth,
            1 - (ref.y + c.y + bh * (0.94 - (t / h) * 0.62)) / ref.pageHeight,
          ]);
        }
        textured(
          points,
          ref,
          coords,
          rgb,
          0.8 + 0.2 * Math.max(0, Math.cos(a - 0.7)),
          false,
          options.horizontal ? [cx, y0, cz + h / 2] : [cx, y0 + h / 2, cz],
        );
      }
  };
  const crate = (c: Component, pixels: Uint8ClampedArray, ref: SpriteRef) => {
    const x = c.x / 32,
      X = (c.X + 1) / 32,
      Z = Math.min(w.depth - 0.025, (c.Y + 1 - 32) / 32),
      z = Math.max(0.025, Z - 0.42),
      h = 0.23,
      t = 0.035;
    const wood = patch(c, pixels, ref);
    box(x, 0, z, X, 0.025, Z, ref, wood);
    box(x, 0, z, x + t, h, Z, ref, wood);
    box(X - t, 0, z, X, h, Z, ref, wood);
    box(x, 0, z, X, h, z + t, ref, wood);
    box(x, 0, Z - t, X, h, Z, ref, wood);
    emit(
      [
        [x + t, h - 0.035, z + t],
        [x + t, h - 0.035, Z - t],
        [X - t, h - 0.035, Z - t],
        [X - t, h - 0.035, z + t],
      ],
      ref,
      uv(ref, c.x, c.y, c.X + 1, c.y + (c.Y - c.y) * 0.55),
    );
  };
  const white = new Uint8Array(W * H);
  for (let i = 0; i < white.length; i++) {
    const j = i * 4,
      r = data.base[j],
      g = data.base[j + 1],
      b = data.base[j + 2];
    white[i] =
      data.base[j + 3] > 200 &&
      Math.abs(r - 165) <= 2 &&
      Math.abs(g - 166) <= 2 &&
      Math.abs(b - 165) <= 2
        ? 1
        : 0;
  }
  // Split L surfaces into horizontal rectangles instead of rejecting their
  // bounding-box density and then turning the remaining counter into a wall.
  const rectangles: Component[] = [];
  const counterRegions = components(white, W, H).filter(
    (c) => c.pixels.length >= 65 && c.Y >= 30,
  );
  for (const c of counterRegions) {
    if (c.pixels.length < 65 || c.Y < 30) continue;
    const mask = new Uint8Array(W * H);
    for (const i of c.pixels) mask[i] = 1;
    // Bridge the small native seam/highlight pixels within a work surface.
    for (let y = Math.max(26, c.y); y <= c.Y; y++)
      for (let x = c.x; x <= c.X; x++)
        if (mask[y * W + x])
          for (let d = 2; d <= 4 && x + d <= c.X; d++)
            if (mask[y * W + x + d])
              for (let k = 1; k < d; k++) mask[y * W + x + k] = 1;
    for (let part = 0; part < 12; part++) {
      const heights = new Uint16Array(W);
      let area = 0,
        best: Component | undefined;
      for (let y = Math.max(26, c.y); y <= c.Y; y++) {
        for (let x = c.x; x <= c.X; x++)
          heights[x] = mask[y * W + x] ? heights[x] + 1 : 0;
        const stack: number[] = [];
        for (let x = c.x; x <= c.X + 1; x++) {
          const height = x <= c.X ? heights[x] : 0;
          while (stack.length && heights[stack[stack.length - 1]] > height) {
            const h = heights[stack.pop()!],
              left = stack.length ? stack[stack.length - 1] + 1 : c.x,
              width = x - left;
            if (width >= 7 && h >= 6 && width * h > area) {
              area = width * h;
              best = { x: left, X: x - 1, y: y - h + 1, Y: y, pixels: [] };
            }
          }
          stack.push(x);
        }
      }
      if (!best || area < 65) break;
      rectangles.push(best);
      for (let y = best.y; y <= best.Y; y++)
        for (let x = best.x; x <= best.X; x++) mask[y * W + x] = 0;
    }
  }
  for (const c of rectangles) {
    // Material-coloured work surfaces are horizontal volumes, not upright art.
    const x = c.x / 32,
      X = (c.X + 1) / 32,
      z = Math.max(0.025, (c.y - 32) / 32),
      Z = Math.min(w.depth - 0.025, (c.Y + 1 - 32) / 32),
      h = w.type === "WORKSHOP_STILL" ? 0.22 : 0.38;
    if (Z <= z) continue;
    counters.push({ x, z, X, Z, height: h });
    const start = faces.length;
    emit(
      [
        [x, h, z],
        [x, h, Z],
        [X, h, Z],
        [X, h, z],
      ],
      art.base,
      uv(art.base, c.x, c.y, c.X + 1, c.Y + 1),
      1,
      true,
    );
    const edgeY = Math.min(H - 2, c.Y + 1),
      side = uv(art.base, c.x, edgeY, c.X + 1, Math.min(H, edgeY + 5));
    emit(
      [
        [x, h, Z],
        [x, 0, Z],
        [X, 0, Z],
        [X, h, Z],
      ],
      art.base,
      side,
      0.85,
      true,
    );
    emit(
      [
        [X, h, z],
        [X, 0, z],
        [x, 0, z],
        [x, h, z],
      ],
      art.base,
      side,
      0.7,
      true,
    );
    emit(
      [
        [x, h, z],
        [x, 0, z],
        [x, 0, Z],
        [x, h, Z],
      ],
      art.base,
      side,
      0.76,
      true,
    );
    emit(
      [
        [X, h, Z],
        [X, 0, Z],
        [X, 0, z],
        [X, h, z],
      ],
      art.base,
      side,
      0.9,
      true,
    );
    emit(
      [
        [x, 0, Z],
        [x, 0, z],
        [X, 0, z],
        [X, 0, Z],
      ],
      art.base,
      side,
      0.5,
      true,
    );
    // The native counters are tops on supports, not solid cabinets.
    // Raise the bottom of the slab, then put real posts beneath its corners.
    for (const f of faces.slice(start))
      for (let i = 1; i < f.positions.length; i += 3)
        if (f.positions[i] === 0) f.positions[i] = h - 0.06;
    const leg = uv(
      art.base,
      c.x + 1,
      Math.min(H - 4, c.Y + 2),
      c.x + 4,
      Math.min(H, c.Y + 6),
    );
    for (const a of [x + 0.025, X - 0.1])
      for (const b of [z + 0.025, Z - 0.1])
        box(a, 0, b, a + 0.075, h - 0.06, b + 0.075, art.base, leg, true);
  }
  const sculpt = (
    c: Component,
    pixels: Uint8ClampedArray,
    ref: SpriteRef,
    base = false,
    options: {
      flat?: boolean;
      depth?: number;
      height?: number;
      y?: number;
      far?: number;
      projection?: { y: number; Y: number };
      round?: boolean;
      cutout?: boolean;
    } = {},
  ) => {
    const bw = c.X - c.x + 1,
      bh = c.Y - c.y + 1,
      area = c.pixels.length;
    const mask = new Set(c.pixels),
      cx = (c.x + c.X + 1) / 64;
    const support = counters.find(
      (s) =>
        c.pixels.filter((i) => {
          const x = (i % W) / 32,
            z = (Math.floor(i / W) - 32) / 32;
          return x >= s.x && x <= s.X && z >= s.z && z <= s.Z;
        }).length /
          area >
        0.65,
    );
    const flat =
      options.flat ??
      (!base &&
        (!!support ||
          area < 130 ||
          Math.min(bw, bh) < 8 ||
          (/METALSMITH|MAGMAFORGE/.test(w.type) && c.y > 80)));
    const y0 = options.y ?? (base ? 0 : (support?.height ?? 0));
    const h =
      options.height ??
      (base
        ? Math.min(0.8, Math.max(0.4, bh / 80))
        : Math.min(0.8 - y0, Math.max(0.13, (bh / 32) * 0.45)));
    const depth =
      options.depth ??
      (flat
        ? 0
        : area / (bw * bh) < 0.42
          ? 0.12
          : Math.min(0.65, Math.max(0.25, h * 0.9)));
    const far =
      options.far ??
      Math.max(
        depth + 0.02,
        Math.min(w.depth - 0.02, (c.Y + 1 - 32) / 32 + 0.06),
      );
    const round =
      options.round ??
      ((base && /FURNACE|QUERN|MILLSTONE/.test(w.type)) ||
        (!flat &&
          /FURNACE|FARMER|FISHERY|STILL|KITCHEN|ASHERY|DYER|TANNER|LEATHER|SOAP/.test(
            w.type,
          ) &&
          bw <= 24 &&
          bh >= 15 &&
          bw / bh < 1.25 &&
          area / (bw * bh) > 0.65));
    if (!base && !flat && !options.cutout && !options.projection) {
      if (round) {
        vessel(c, pixels, ref, { y: y0, height: h });
        return;
      }
      if (bw >= 24 && bh >= 24 && area / (bw * bh) > 0.55) {
        nativeBox(c, pixels, ref, y0, h);
        return;
      }
    }
    const zAt = (x: number, back: boolean) =>
      far -
      depth / 2 +
      (back ? -1 : 1) *
        (round
          ? (Math.max(
              0.03,
              Math.sqrt(
                Math.max(0, 1 - ((x - (c.x + c.X + 1) / 2) / (bw / 2)) ** 2),
              ),
            ) *
              depth) /
            2
          : depth / 2);
    const pos = (x: number, y: number, back: boolean) =>
      flat
        ? [
            x / 32,
            y0 + (back ? 0 : 0.025),
            (y - 32) / 32 + Math.max(0, (32 - c.y) / 32 + 0.02),
          ]
        : [
            x / 32,
            y0 +
              (((options.projection?.Y ?? c.Y) + 1 - y) /
                (options.projection
                  ? options.projection.Y - options.projection.y + 1
                  : bh)) *
                h,
            zAt(x, back),
          ];
    // Merge opaque vertical runs. Native RGB/detail stays in UVs, rather than
    // becoming thousands of individually coloured cubes.
    for (let x = c.x; x <= c.X; x++)
      for (let y = c.y; y <= c.Y; y++)
        if (mask.has(y * W + x)) {
          let Y = y + 1;
          while (Y <= c.Y && mask.has(Y * W + x)) Y++;
          const front = [
            pos(x, y, false),
            pos(x, Y, false),
            pos(x + 1, Y, false),
            pos(x + 1, y, false),
          ];
          emit(front, ref, uv(ref, x, y, x + 1, Y), 1, base);
          emit(
            [
              pos(x + 1, y, true),
              pos(x + 1, Y, true),
              pos(x, Y, true),
              pos(x, y, true),
            ],
            ref,
            uv(ref, x, y, x + 1, Y),
            0.82,
            base,
          );
          y = Y - 1;
        }
    for (const i of c.pixels) {
      const x = i % W,
        y = Math.floor(i / W);
      for (const [dx, dy, edge] of [
        [0, -1, 0],
        [1, 0, 1],
        [0, 1, 2],
        [-1, 0, 3],
      ])
        if (!mask.has(i + dy * W + dx)) {
          const corners = [
              [x, y],
              [x + 1, y],
              [x + 1, y + 1],
              [x, y + 1],
            ],
            a = corners[edge],
            b = corners[(edge + 1) % 4];
          const sx = Math.max(
              c.x,
              Math.min(c.X, x + (dx < 0 ? 2 : dx > 0 ? -2 : 0)),
            ),
            sy = Math.max(
              c.y,
              Math.min(c.Y, y + (dy < 0 ? 2 : dy > 0 ? -2 : 0)),
            );
          const points = [
            pos(a[0], a[1], false),
            pos(a[0], a[1], true),
            pos(b[0], b[1], true),
            pos(b[0], b[1], false),
          ];
          let coords = uv(ref, sx, sy, sx + 1, sy + 1);
          if (!flat && edge === 0) {
            const yTop = c.y + Math.max(1, bh * 0.12),
              yBottom = c.y + Math.max(2, bh * 0.32);
            coords = [a[0], yBottom, a[0], yTop, b[0], yTop, b[0], yBottom].map(
              (v, k) =>
                k % 2
                  ? 1 - (ref.y + v) / ref.pageHeight
                  : (ref.x + v) / ref.pageWidth,
            );
          }
          emit(points, ref, coords, 0.9, base);
        }
    }
  };
  if (w.type === "TRADE_DEPOT" && art.decor && data.decor) {
    faces.length = 0;
    const ref = art.decor,
      pixels = data.decor;
    const whole: Component = {
      pixels: Array.from({ length: W * H }, (_, i) => i).filter(
        (i) => pixels[i * 4 + 3] > 100,
      ),
      x: 0,
      y: 0,
      X: W - 1,
      Y: H - 1,
    };
    const table = (
      x: number,
      z: number,
      X: number,
      Z: number,
      source: number[],
      h = 0.42,
    ) => {
      const tex = uv(ref, ...(source as [number, number, number, number]));
      box(x, h - 0.055, z, X, h, Z, ref, tex);
      const leg = uv(ref, 8, 70, 16, 90);
      for (const a of [x + 0.04, X - 0.105])
        for (const b of [z + 0.04, Z - 0.105])
          box(a, 0, b, a + 0.065, h - 0.055, b + 0.065, ref, leg);
    };
    table(0.08, 0.68, 1.02, 4.35, [5, 48, 31, 168]);
    table(3.98, 0.68, 4.92, 4.35, [128, 48, 156, 168]);
    table(2.05, 2.2, 2.92, 3.0, [65, 104, 94, 130]);
    table(2.63, 1.4, 3.15, 1.72, [86, 76, 102, 87], 0.25);
    table(2.05, 3.32, 2.57, 3.64, [65, 137, 81, 146], 0.25);
    for (const [x, y, X, Y, cx, cz] of [
      [2, 10, 20, 39, 0.26, 0.32],
      [19, 7, 40, 42, 0.85, 0.3],
    ]) {
      const c = sub(whole, x, y, X, Y);
      if (c)
        vessel(c, pixels, ref, { x: cx, z: cz, radius: 0.24, height: 0.43 });
    }
    for (const [x, y, X, Y] of [
      [40, 17, 64, 47],
      [40, 48, 60, 66],
      [124, 174, 140, 190],
      [141, 174, 158, 190],
    ]) {
      const c = sub(whole, x, y, X, Y);
      if (c) nativeBox(c, pixels, ref, 0, 0.33);
    }
    for (const [x, y, X, Y, cx, cz] of [
      [125, 13, 141, 40, 4.2, 0.3],
      [141, 10, 159, 42, 4.7, 0.3],
      [2, 173, 30, 191, 0.5, 4.7],
    ]) {
      const c = sub(whole, x, y, X, Y);
      if (c)
        vessel(c, pixels, ref, { x: cx, z: cz, radius: 0.23, height: 0.4 });
    }
    return faces;
  }
  const baseMask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        j = i * 4;
      if (data.base[j + 3] < 200) continue;
      if (
        counterRegions.some(
          (c) => x >= c.x - 4 && x <= c.X + 4 && y >= c.y - 4 && y <= c.Y + 7,
        )
      )
        continue;
      const bg = data.background;
      const diff = !bg
        ? 0
        : Math.abs(data.base[j] - bg[j]) +
          Math.abs(data.base[j + 1] - bg[j + 1]) +
          Math.abs(data.base[j + 2] - bg[j + 2]);
      if (
        (w.width === 1 || y < 32 || diff > 110) &&
        (!w.type.startsWith("FURNACE_") || y < 86)
      )
        baseMask[i] = 1;
    }
  if (w.type.startsWith("FURNACE_")) {
    const wide = /KILN|LAVA/.test(w.type);
    const polygon = wide
      ? [
          [0, 80],
          [0, 38],
          [6, 25],
          [21, 15],
          [37, 10],
          [59, 10],
          [78, 18],
          [92, 30],
          [96, 45],
          [96, 80],
        ]
      : [
          [18, 75],
          [15, 60],
          [18, 44],
          [26, 29],
          [36, 23],
          [42, 20],
          [58, 20],
          [71, 29],
          [79, 45],
          [81, 59],
          [75, 72],
          [65, 80],
          [30, 80],
        ];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i],
            b = polygon[j];
          if (
            a[1] > y !== b[1] > y &&
            x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        if (
          /SMELTER|GLASS/.test(w.type) &&
          x >= 40 &&
          x < 55 &&
          y >= 8 &&
          y < 25
        )
          inside = true;
        baseMask[y * W + x] =
          inside && data.base[(y * W + x) * 4 + 3] > 100 ? 1 : 0;
      }
  }
  if (w.width === 1) {
    const pixels = Array.from({ length: W * H }, (_, i) => i).filter(
        (i) => data.base[i * 4 + 3] > 100,
      ),
      whole: Component = { pixels, x: 0, y: 0, X: W - 1, Y: H - 1 };
    const press = w.type.includes("SCREW_PRESS"),
      body = sub(whole, press ? 4 : 1, press ? 33 : 31, press ? 28 : 30, 62);
    if (body)
      vessel(body, data.base, art.base, {
        x: 0.5,
        z: 0.5,
        radius: press ? 0.34 : 0.43,
        height: press ? 0.48 : 0.38,
        hole: false,
        ...(press
          ? {}
          : { top: [4, 35, 12, 41] as [number, number, number, number] }),
      });
    if (press) {
      const wood = uv(art.base, 7, 38, 10, 48);
      for (const x of [0.09, 0.84])
        for (const z of [0.25, 0.7])
          box(x, 0, z, x + 0.065, 0.81, z + 0.065, art.base, wood);
      box(0.09, 0.75, 0.25, 0.905, 0.83, 0.765, art.base, wood);
      box(0.08, 0.81, 0.47, 0.92, 0.85, 0.53, art.base, wood);
      box(0.17, 0.455, 0.2, 0.83, 0.49, 0.8, art.base, wood);
      box(
        0.47,
        0.45,
        0.47,
        0.53,
        0.78,
        0.53,
        art.base,
        uv(art.base, 14, 24, 18, 34),
      );
    } else {
      const quern = w.type.includes("QUERN"),
        tex = uv(
          art.base,
          quern ? 2 : 15,
          quern ? 12 : 5,
          quern ? 6 : 19,
          quern ? 17 : 15,
        );
      box(0.46, 0.33, 0.46, 0.54, quern ? 0.53 : 0.84, 0.54, art.base, tex);
      if (quern) {
        const start = faces.length;
        box(0.18, 0.49, 0.46, 0.55, 0.54, 0.54, art.base, tex);
        for (const f of faces.slice(start))
          for (let i = 0; i < f.positions.length; i += 3) {
            const x = f.positions[i] - 0.5,
              z = f.positions[i + 2] - 0.5;
            f.positions[i] = 0.5 + (x - z) * Math.SQRT1_2;
            f.positions[i + 2] = 0.5 + (x + z) * Math.SQRT1_2;
          }
      } else
        box(
          0.42,
          0.78,
          0.42,
          0.58,
          0.86,
          0.58,
          art.base,
          uv(art.base, 13, 2, 20, 9),
        );
    }
    return faces;
  }
  if (w.type.startsWith("FURNACE_")) {
    const wide = /KILN|LAVA/.test(w.type),
      cx = 1.5,
      cz = 0.9,
      rx = wide ? 1.38 : 0.94,
      rz = wide ? 0.85 : 0.7,
      h = 0.78;
    const shell: Component = {
      pixels: [],
      x: wide ? 4 : 20,
      y: wide ? 15 : 30,
      X: wide ? 90 : 77,
      Y: 74,
    };
    for (let y = shell.y; y <= shell.Y; y++)
      for (let x = shell.x; x <= shell.X; x++)
        if (baseMask[y * W + x]) shell.pixels.push(y * W + x);
    const rgb = colour(shell, data.base),
      side = patch(shell, data.base, art.base);
    const point = (a: number, t: number) => [
      cx + rx * Math.cos(a) * Math.cos(t),
      h * Math.sin(t),
      cz + rz * Math.sin(a) * Math.cos(t),
    ];
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2,
          b = ((i + 1) / 24) * Math.PI * 2,
          t = ((j / 8) * Math.PI) / 2,
          T = (((j + 1) / 8) * Math.PI) / 2,
          points = [point(a, t), point(b, t), point(b, T), point(a, T)];
        // The front maps the original furnace face; the unseen back uses its
        // masonry texture, rather than stretching the silhouette's edge pixels.
        const front = Math.sin((a + b) / 2) > 0;
        const coords = front
          ? points.flatMap((p) => [
              (art.base.x +
                (wide ? 0 : 16) +
                ((p[0] - (cx - rx)) / (2 * rx)) * (wide ? 96 : 66)) /
                art.base.pageWidth,
              1 -
                (art.base.y + 80 - (p[1] / h) * (wide ? 70 : 57)) /
                  art.base.pageHeight,
            ])
          : side;
        textured(
          points,
          art.base,
          coords,
          rgb,
          0.86 + 0.14 * Math.max(0, Math.sin(a)),
          true,
          [cx, 0, cz],
        );
      }
    if (/SMELTER|GLASS/.test(w.type))
      box(
        1.28,
        0.61,
        0.68,
        1.72,
        0.86,
        1.12,
        art.base,
        uv(art.base, 40, 9, 55, 24),
        true,
      );
  }
  for (const c of components(baseMask, W, H))
    if (
      !w.type.startsWith("FURNACE_") &&
      c.pixels.length >= 70 &&
      c.Y - c.y > 7 &&
      c.X - c.x > 6 &&
      (w.width === 1 ||
        w.type.startsWith("FURNACE_") ||
        c.pixels.length < W * H * 0.45)
    )
      sculpt(
        c,
        data.base,
        art.base,
        true,
        w.type.startsWith("FURNACE_")
          ? {
              height: 0.8,
              depth: 1.3,
              far: 1.6,
              round: !/KILN|LAVA/.test(w.type),
            }
          : {},
      );
  if (data.decor && art.decor) {
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < mask.length; i++)
      mask[i] = data.decor[i * 4 + 3] > 100 ? 1 : 0;
    for (const c of components(mask, W, H))
      if (c.pixels.length > 1) {
        const pixels = data.decor,
          ref = art.decor;
        if (w.type === "WORKSHOP_STILL") {
          if (c.x < 30 && c.y >= 48 && c.Y < 70) {
            sculpt(c, pixels, ref, false, {
              flat: false,
              cutout: true,
              height: 0.18,
              y: 0.015,
              depth: 0.012,
              far: 0.82,
              round: false,
            });
            continue;
          }
          if (c.y < 20 && c.X > 60) {
            const copper = sub(c, 4, 2, 30, 48),
              receiver = sub(c, 31, 23, 48, 56);
            if (copper)
              vessel(copper, pixels, ref, {
                x: 0.52,
                z: 0.5,
                y: 0.22,
                height: 0.55,
                radius: 0.34,
                hole: false,
                still: true,
              });
            if (receiver)
              vessel(receiver, pixels, ref, {
                x: 1.25,
                z: 0.55,
                height: 0.45,
                radius: 0.22,
              });
            const pipe = uv(ref, 15, 6, 19, 9);
            box(0.65, 0.71, 0.45, 1.25, 0.75, 0.5, ref, pipe);
            box(1.2, 0.43, 0.45, 1.25, 0.75, 0.5, ref, pipe);
            for (const [x, y, X, Y, cx, cy, cz] of [
              [62, 13, 84, 42, 2.23, 0.58, 0.17],
              [48, 30, 70, 58, 1.84, 0.25, 0.26],
              [71, 30, 94, 58, 2.58, 0.25, 0.26],
            ]) {
              const p = sub(c, x, y, X, Y);
              if (p)
                vessel(p, pixels, ref, {
                  horizontal: true,
                  x: cx,
                  y: cy,
                  z: cz,
                  radius: 0.24,
                  height: 0.47,
                });
            }
            continue;
          }
          if (c.y > 80 && c.x < 40) {
            for (const [x, y, X, Y, cx, cz] of [
              [2, 83, 22, 110, 0.35, 2.25],
              [14, 99, 38, 122, 0.85, 2.67],
            ]) {
              const p = sub(c, x, y, X, Y);
              if (p)
                vessel(p, pixels, ref, {
                  x: cx,
                  z: cz,
                  radius: 0.23,
                  height: 0.38,
                });
            }
            continue;
          }
          if (c.y > 90 && c.X > 65) {
            for (const [x, X] of [
              [40, 65],
              [66, 95],
            ]) {
              const p = sub(c, x, 90, X, 127);
              if (p) crate(p, pixels, ref);
            }
            continue;
          }
        }
        if (w.type === "WORKSHOP_LOOM" && c.y < 30 && c.X > 60 && c.x < 25) {
          const main = sub(c, 22, 16, 77, 83);
          if (main) {
            const far = 1.62;
            sculpt(main, pixels, ref, false, {
              flat: false,
              height: 0.8,
              depth: 0.075,
              far,
              projection: { y: 17, Y: 82 },
              round: false,
              cutout: true,
            });
            const wood = uv(ref, 24, 20, 28, 27),
              left = 24 / 32,
              right = 72 / 32;
            for (const x of [left, right]) {
              box(x, 0, far - 0.65, x + 0.065, 0.8, far - 0.58, ref, wood);
              for (const y of [0.18, 0.65])
                box(x, y, far - 0.65, x + 0.065, y + 0.05, far, ref, wood);
            }
            box(
              left,
              0.74,
              far - 0.65,
              right + 0.065,
              0.81,
              far - 0.58,
              ref,
              wood,
            );
          }
          for (const [x, y, X, Y, cx, cz] of [
            [3, 28, 20, 53, 0.35, 0.6],
            [3, 49, 15, 72, 0.3, 1.1],
            [14, 48, 22, 72, 0.63, 1.08],
          ]) {
            const p = sub(c, x, y, X, Y);
            if (p)
              vessel(p, pixels, ref, {
                x: cx,
                z: cz,
                radius: 0.14,
                height: 0.3,
              });
          }
          continue;
        }
        if (w.type === "WORKSHOP_LOOM" && c.y > 90) {
          const basket = sub(c, 60, 90, 95, 127);
          if (basket) crate(basket, pixels, ref);
          const loose = sub(c, 0, 90, 59, 127);
          if (loose) sculpt(loose, pixels, ref, false, { flat: true });
          continue;
        }
        if (w.type === "WORKSHOP_MECHANIC" && c.y < 30 && c.X > 60) {
          for (const [x, X, d] of [
            [0, 31, 0.12],
            [32, 63, 0.4],
            [64, 95, 0.15],
          ]) {
            const p = sub(c, x, 0, X, 70);
            if (p)
              sculpt(p, pixels, ref, false, {
                flat: false,
                height: 0.8,
                depth: d,
                far: 1.15,
                projection: { y: 14, Y: 66 },
                round: false,
                cutout: true,
              });
          }
          const metal = uv(ref, 67, 20, 70, 30);
          for (const x of [2.12, 2.55, 2.84])
            box(x, 0.02, 0.65, x + 0.07, 0.7, 1.02, ref, metal);
          continue;
        }
        if (/METALSMITH|MAGMAFORGE/.test(w.type)) {
          if (c.x >= 30 && c.x < 50 && c.y < 45) {
            sculpt(c, pixels, ref, false, {
              flat: false,
              height: 0.35,
              depth: 0.25,
              round: false,
              cutout: true,
            });
            continue;
          }
          if (c.x < 10 && c.y > 70 && c.Y > 105) {
            const barrel = sub(c, 2, 77, 23, 105),
              bucket = sub(c, 22, 97, 35, 122),
              bars = sub(c, 2, 106, 24, 125);
            if (barrel)
              vessel(barrel, pixels, ref, {
                x: 0.42,
                z: 1.95,
                radius: 0.27,
                height: 0.47,
              });
            if (bucket)
              vessel(bucket, pixels, ref, {
                x: 0.88,
                z: 2.63,
                radius: 0.17,
                height: 0.3,
              });
            if (bars) sculpt(bars, pixels, ref, false, { flat: true });
            continue;
          }
          sculpt(c, pixels, ref, false, { flat: true });
          continue;
        }
        if (w.type === "WORKSHOP_FARMER" && c.x > 40 && c.y > 60) {
          sculpt(c, pixels, ref, false, {
            flat: false,
            height: 0.5,
            depth: 0.08,
            round: false,
            cutout: true,
          });
          continue;
        }
        if (
          w.type === "WORKSHOP_MECHANIC" &&
          c.y > 65 &&
          !(c.x > 40 && c.X < 64)
        ) {
          sculpt(c, pixels, ref, false, { flat: true });
          continue;
        }
        sculpt(c, pixels, ref);
      }
  }
  return faces;
}
