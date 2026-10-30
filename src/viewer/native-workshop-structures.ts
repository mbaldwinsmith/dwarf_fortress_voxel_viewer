import type { SceneryObject } from "../shared/model.js";
import type { NativeWorkshopPixels } from "./native-workshop-relief.js";
import {
  NativeWorkshopGeometry,
  type Point,
  type Rect,
} from "./native-workshop-geometry.js";

export function nativeWorkshopStructures(
  o: SceneryObject,
  pixels: NativeWorkshopPixels,
) {
  const type = o.workshop!.type,
    g = new NativeWorkshopGeometry(o, pixels);
  if (o.workshop!.width === 1) {
    const press = type.includes("SCREW_PRESS"),
      quern = type.includes("QUERN");
    if (!press && !quern && !type.includes("MILLSTONE")) return;
    const lever = (
      height: number,
      top: ReturnType<typeof g.skin>,
      side: ReturnType<typeof g.skin>,
    ) => {
      const start = g.faces.length;
      g.box(
        [0.07, height - 0.025, 0.465],
        [0.93, height + 0.025, 0.535],
        side,
        top,
      );
      const angle = -Math.PI * 0.47;
      for (const f of g.faces.slice(start))
        for (let i = 0; i < f.positions.length; i += 3) {
          const x = f.positions[i] - 0.5,
            z = f.positions[i + 2] - 0.5;
          f.positions[i] = 0.5 + x * Math.cos(angle) - z * Math.sin(angle);
          f.positions[i + 2] = 0.5 + x * Math.sin(angle) + z * Math.cos(angle);
        }
    };
    if (press) {
      const post = g.skin([3, 33, 5, 38], true),
        beamTop = g.skin([21, 28, 29, 30], true),
        beamSide = g.skin([21, 30, 29, 31], true);
      const stave = g.skin([8, 45, 23, 53], true),
        hoop = g.skin([13, 42, 18, 44], true),
        inside = g.skin([13, 35, 20, 36], true);
      g.lathe([0.5, 0.02, 0.5], 0.31, 0.44, stave, inside, "open");
      for (const y of [0.08, 0.34])
        g.lathe([0.5, y, 0.5], 0.314, 0.025, hoop, hoop, "stone");
      for (const x of [0.13, 0.82]) {
        g.box([x, 0, 0.43], [x + 0.05, 0.76, 0.5], post);
        g.box([x - 0.045, 0, 0.24], [x + 0.095, 0.045, 0.74], post);
      }
      g.box([0.1, 0.71, 0.4], [0.9, 0.77, 0.53], beamSide, beamTop);
      g.lathe(
        [0.5, 0.405, 0.5],
        0.235,
        0.04,
        g.skin([12, 32, 20, 33], true),
        g.skin([12, 31, 20, 32], true),
        "stone",
      );
      g.beam([0.5, 0.44, 0.5], [0.5, 0.79, 0.5], 0.035, post, 8);
      for (let y = 0.48; y < 0.71; y += 0.035)
        g.lathe([0.5, y, 0.5], 0.045, 0.012, post, beamSide, "stone");
      lever(
        0.8,
        g.skin([22, 20, 24, 21], true),
        g.skin([24, 20, 26, 21], true),
      );
    } else {
      const stone = g.skin(quern ? [8, 44, 24, 48] : [6, 44, 25, 47], true);
      const lower = g.skin([7, 55, quern ? 25 : 26, 60], true),
        upper = g.skin([7, 49, quern ? 25 : 26, 55], true);
      g.lathe([0.5, 0.025, 0.5], 0.43, 0.15, lower, stone, "stone", false, 12);
      g.lathe([0.5, 0.19, 0.5], 0.42, 0.18, upper, stone, "stone", false, 12);
      if (quern) {
        g.box(
          [0.42, 0.36, 0.46],
          [0.465, 0.49, 0.54],
          g.skin([12, 40, 14, 42], true),
        );
        g.box(
          [0.535, 0.36, 0.46],
          [0.58, 0.49, 0.54],
          g.skin([16, 38, 18, 40], true),
        );
        lever(
          0.51,
          g.skin([13, 36, 15, 37], true),
          g.skin([15, 36, 18, 37], true),
        );
      } else {
        const wood = g.skin([13, 34, 18, 40], true),
          metal = g.skin([14, 57, 18, 59], true);
        g.lathe(
          [0.5, 0.365, 0.5],
          0.085,
          0.035,
          g.skin([13, 43, 18, 44], true),
          g.skin([13, 41, 18, 43], true),
          "stone",
        );
        g.beam([0.5, 0.39, 0.5], [0.5, 0.64, 0.5], 0.058, wood, 8);
        g.lathe(
          [0.5, 0.62, 0.5],
          0.075,
          0.035,
          g.skin([12, 30, 19, 33], true),
          g.skin([13, 28, 18, 29], true),
          "stone",
        );
        g.wheel([0.5, 0.16, 0.91], 0.13, metal, 0.07, 6);
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5,
            x = 0.5 + Math.cos(a) * 0.135,
            y = 0.16 + Math.sin(a) * 0.135;
          g.box(
            [x - 0.025, y - 0.025, 0.865],
            [x + 0.025, y + 0.025, 0.955],
            metal,
            g.skin([14, 55, 17, 56], true),
          );
        }
        g.beam([0.5, 0.15, 0.5], [0.5, 0.15, 0.94], 0.045, wood);
      }
    }
    return g.faces;
  }
  if (!type.startsWith("FURNACE_")) return;
  const magma = type.includes("LAVA"),
    wood = type.includes("WOOD"),
    kiln = type.includes("KILN"),
    smelter = type.includes("SMELTER");
  const cx = 1.5,
    front = 1.59,
    back = 0.26,
    rx = smelter ? 1.12 : magma ? 1.02 : 0.86,
    h = smelter ? 0.73 : magma ? 0.65 : 0.64,
    foot = 0.06;
  const masonry = g.patch(
    smelter ? [23, 41, 38, 50] : magma ? [9, 42, 22, 56] : [26, 45, 36, 57],
    true,
  );
  const dark = g.patch([39, 55, 59, 68], true, "dark");
  const ir = wood ? 0.23 : 0.36,
    ih = wood ? 0.28 : 0.38;
  const p = (r: number, H: number, a: number, z: number): Point => [
    cx + r * Math.cos(a),
    foot + H * Math.sin(a),
    z,
  ];
  // Smelters have a broad masonry arch; the other native furnaces are domes.
  if (smelter)
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 20,
        b = ((i + 1) * Math.PI) / 20;
      g.projected(
        [
          p(rx, h, a, front),
          p(ir, ih, a, front + 0.008),
          p(ir, ih, b, front + 0.008),
          p(rx, h, b, front),
        ],
        g.skin(
          type.includes("GLASS")
            ? [18, 44, 79, 73]
            : magma || kiln
              ? [6, 40, 90, 73]
              : [18, 41, 79, 69],
          true,
        ),
        [cx - rx, foot, cx + rx, foot + h],
      );
      g.face(
        [
          p(ir, ih, a, front + 0.008),
          p(ir, ih, a, front - 0.26),
          p(ir, ih, b, front - 0.26),
          p(ir, ih, b, front + 0.008),
        ],
        dark,
        0.7,
      );
      for (let j = 0; j < 8; j++) {
        const z = front - ((front - back) * j) / 8,
          Z = front - ((front - back) * (j + 1)) / 8;
        const shrink = (t: number) =>
          Math.sqrt(Math.max(0, 1 - ((t - 0.18) / 0.82) ** 2));
        const s = shrink(j / 8),
          S = shrink((j + 1) / 8);
        g.tiled(
          [
            p(rx * s, h * s, a, z),
            p(rx * S, h * S, a, Z),
            p(rx * S, h * S, b, Z),
            p(rx * s, h * s, b, z),
          ],
          masonry,
          [
            a * rx * 22,
            (front - z) * 22,
            a * rx * 22,
            (front - Z) * 22,
            b * rx * 22,
            (front - Z) * 22,
            b * rx * 22,
            (front - z) * 22,
          ],
          0.93,
        );
      }
    }
  else {
    const cz = 0.93,
      rz = 0.68;
    const surface = (a: number, t: number): Point => [
      cx + rx * Math.sqrt(Math.max(0, 1 - t * t)) * Math.cos(a),
      foot + h * t,
      cz + rz * Math.sqrt(Math.max(0, 1 - t * t)) * Math.sin(a),
    ];
    const lip = (a: number) => {
      const q = ((rx * Math.cos(a)) / ir) ** 2;
      return Math.sin(a) > 0 && q < 1
        ? Math.sqrt((1 - q) / ((h / ih) ** 2 - q))
        : 0;
    };
    const angles = Array.from({ length: 49 }, (_, i) => (i * Math.PI) / 24);
    angles.push(Math.acos(ir / rx), Math.acos(-ir / rx));
    angles.sort((a, b) => a - b);
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1],
        low = lip(a),
        high = lip(b);
      for (let j = 0; j < 12; j++) {
        const t = j / 12,
          T = (j + 1) / 12;
        const points = [
          surface(a, low + (1 - low) * t),
          surface(b, high + (1 - high) * t),
          surface(b, high + (1 - high) * T),
          surface(a, low + (1 - low) * T),
        ];
        g.tiled(
          points,
          masonry,
          points.flatMap((p, i) => [
            (i === 0 || i === 3 ? a : b) * rx * 22,
            Math.asin(Math.min(1, (p[1] - foot) / h)) * h * 22,
          ]),
          0.96,
        );
      }
      if (low > 0 || high > 0) {
        const A = surface(a, low),
          B = surface(b, high);
        g.face(
          [A, [A[0], A[1], front - 0.29], [B[0], B[1], front - 0.29], B],
          dark,
          0.7,
        );
      }
    }
  }
  const baseStart = g.faces.length;
  g.lathe([cx, 0, 0.91], rx, 0.04, masonry, masonry, "stone", false, true);
  for (const f of g.faces.slice(baseStart))
    for (let i = 2; i < f.positions.length; i += 3)
      f.positions[i] = 0.91 + ((f.positions[i] - 0.91) * 0.7) / rx;
  g.box(
    [cx - ir, foot, front - 0.28],
    [cx + ir, foot + ih * 0.88, front - 0.27],
    dark,
  );
  // Fire is a separate native alpha surface inside the actual aperture.
  if (pixels.decor) {
    let x = 96,
      y = 128,
      X = 0,
      Y = 0;
    for (let b = 50; b < 73; b++)
      for (let a = 32; a < 66; a++) {
        const j = (b * pixels.width + a) * 4,
          d = pixels.decor;
        if (
          d[j + 3] > 150 &&
          d[j] > 140 &&
          d[j] > d[j + 2] * 1.5 &&
          d[j + 1] > 55
        ) {
          x = Math.min(x, a);
          X = Math.max(X, a + 1);
          y = Math.min(y, b);
          Y = Math.max(Y, b + 1);
        }
      }
    if (X > x)
      g.face(
        [
          [cx - ir * 0.93, foot + ih * 0.9, front - 0.05],
          [cx - ir * 0.93, foot, front - 0.05],
          [cx + ir * 0.93, foot, front - 0.05],
          [cx + ir * 0.93, foot + ih * 0.9, front - 0.05],
        ],
        g.skin([x, y, X, Y]),
      );
  }
  if (magma) {
    const column = g.patch([3, 32, 13, 46], true);
    for (const x of [0.28, 2.72]) {
      g.lathe([x, 0, 0.66], 0.22, 0.48, column, masonry, "stone");
      const direction = x < 1 ? 1 : -1;
      const path: Point[] = [
        [x, 0.41, 0.66],
        [x, 0.5, 0.66],
        [x + direction * 0.04, 0.55, 0.68],
        [x + direction * 0.14, 0.57, 0.71],
        [x + direction * 0.27, 0.55, 0.74],
        [x + direction * 0.4, 0.47, 0.78],
      ];
      for (let i = 0; i < path.length - 1; i++)
        g.beam(path[i], path[i + 1], 0.095, column, 10);
    }
    g.box([1.23, 0.61, 0.62], [1.77, 0.77, 1.02], dark);
    for (let x = 1.28; x < 1.76; x += 0.1)
      g.box([x, 0.77, 0.62], [x + 0.038, 0.805, 1.02], masonry);
  } else {
    const chimney = wood
      ? [42, 26, 55, 37]
      : kiln
        ? [40, 8, 55, 25]
        : [40, 9, 55, 25];
    const rim = g.patch(chimney as Rect, true),
      wall = g.patch(wood ? [44, 34, 52, 39] : [43, 23, 53, 29], true),
      z = 0.57,
      t = 0.065;
    const lo = 1.3,
      hi = 1.7,
      H = wood ? 0.79 : 0.86;
    g.box([lo, 0.3, z], [lo + t, H, z + 0.4], wall, rim);
    g.box([hi - t, 0.3, z], [hi, H, z + 0.4], wall, rim);
    g.box([lo, 0.3, z], [hi, H, z + t], wall, rim);
    g.box([lo, 0.3, z + 0.4 - t], [hi, H, z + 0.4], wall, rim);
    g.box([lo + t, 0.6, z + t], [hi - t, 0.61, z + 0.4 - t], dark);
  }
  return g.faces;
}
