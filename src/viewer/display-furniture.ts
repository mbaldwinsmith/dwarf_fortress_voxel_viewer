import type { SceneryObject } from "../shared/model.js";
import { FurnitureGeometry, type Point } from "./furniture-geometry.js";
const types = new Set([
  "slab",
  "tractionbench",
  "statue",
  "altar",
  "pedestal",
  "displaycase",
]);
export function displayFurnitureFaces(o: SceneryObject, ground: number) {
  const type = o.furniture?.type;
  if (!type || !types.has(type) || !o.sprite) return;
  const g = new FurnitureGeometry(o, ground),
    skin = g.crop(
      type === "slab"
        ? [12, 10, 8, 12]
        : type === "tractionbench"
          ? o.furniture?.material === "wood"
            ? [17, 6, 9, 12]
            : o.furniture?.material === "stone"
              ? [16, 7, 8, 6]
              : [24, 8, 3, 3]
          : type === "statue"
            ? [9, 20, 15, 7]
            : type === "altar"
              ? [12, 24, 10, 1]
              : type === "displaycase"
                ? [11, 24, 11, 1]
                : [13, 24, 8, 1],
    );
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
  ) =>
    g.box(
      x,
      y,
      z,
      X,
      Y,
      Z,
      skin,
      undefined,
      o.furniture?.material === "wood" && Y - y > Math.max(X - x, Z - z),
    );
  if (type === "pedestal" || type === "statue") {
    const h = type === "statue" ? 0.2 : 0.4;
    const cap = g.crop(type === "statue" ? [8, 4, 1, 1] : [12, 16, 7, 6]);
    g.lathe(
      [
        [0, 0],
        [0.32, 0],
        [0.32, 0.035],
        [0.28, 0.065],
        [0.18, 0.065],
        [0.18, h - 0.065],
        [0.29, h - 0.065],
      ],
      skin,
      undefined,
      8,
    );
    g.lathe(
      [
        [0.29, h - 0.065],
        [0.32, h - 0.035],
        [0.32, h],
        [0, h],
      ],
      cap,
      undefined,
      8,
    );
    const highlight = g.crop(
      type === "statue" ? [13, 16, 1, 1] : [12, 14, 1, 1],
    );
    g.lathe(
      [
        [0.321, h - 0.008],
        [0.321, h - 0.002],
      ],
      highlight,
      undefined,
      8,
    );
  } else if (type === "slab") {
    const field = g.crop([10, 9, 11, 10]),
      rim = g.crop([10, 5, 1, 1]);
    g.box(0.22, 0, 0.37, 0.78, 0.055, 0.63, field);
    g.box(0.24, 0.055, 0.39, 0.76, 0.075, 0.61, field);
    const outline = [
      [0.27, 0.075],
      [0.73, 0.075],
      [0.73, 0.47],
      [0.54, 0.64],
      [0.46, 0.64],
      [0.27, 0.47],
    ];
    const inner = outline.map(([x, y]) => [
      0.5 + (x - 0.5) * 0.9,
      0.075 + (y - 0.075) * 0.94 + 0.012,
    ]);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6,
        [x, y] = outline[i],
        [X, Y] = outline[j],
        [u, v] = inner[i],
        [U, V] = inner[j];
      g.face(
        [
          [x, y, 0.43],
          [X, Y, 0.43],
          [X, Y, 0.565],
          [x, y, 0.565],
        ],
        field,
        0.82,
      );
      g.face(
        [
          [x, y, 0.565],
          [X, Y, 0.565],
          [U, V, 0.579],
          [u, v, 0.579],
        ],
        rim,
        i >= 2 && i <= 4 ? 1 : 0.7,
      );
    }
    for (const z of [0.43, 0.579]) {
      const p = z > 0.5 ? inner : outline;
      g.face(
        [
          [p[5][0], p[5][1], z],
          [p[0][0], p[0][1], z],
          [p[1][0], p[1][1], z],
          [p[2][0], p[2][1], z],
        ],
        field,
        z > 0.5 ? 1 : 0.75,
      );
      g.face(
        [
          [p[4][0], p[4][1], z],
          [p[5][0], p[5][1], z],
          [p[2][0], p[2][1], z],
          [p[3][0], p[3][1], z],
        ],
        field,
        z > 0.5 ? 1 : 0.75,
      );
    }
  } else if (type === "altar") {
    box(0.25, 0, 0.22, 0.75, 0.055, 0.78);
    box(0.3, 0.055, 0.28, 0.7, 0.28, 0.72);
    box(0.1, 0.28, 0.12, 0.9, 0.335, 0.88);
    const cap = g.crop([10, 12, 12, 1]);
    g.box(0.1, 0.335, 0.12, 0.9, 0.345, 0.88, cap);
    g.box(0.12, 0.345, 0.14, 0.88, 0.36, 0.86, cap);
    const cloth = g.crop([9, 14, 14, 5]);
    g.box(0.35, 0.36, 0.12, 0.65, 0.369, 0.88, cloth);
    g.box(0.35, 0.23, 0.112, 0.65, 0.369, 0.125, cloth);
    g.box(0.35, 0.23, 0.875, 0.65, 0.369, 0.888, cloth);
  } else if (type === "tractionbench") {
    for (const x of [0.18, 0.75])
      for (const z of [0.12, 0.8]) box(x, 0, z, x + 0.07, 0.23, z + 0.07);
    box(0.16, 0.23, 0.09, 0.84, 0.28, 0.91);
    box(0.21, 0.28, 0.19, 0.79, 0.315, 0.8);
    for (const z of [0.12, 0.84]) {
      box(0.16, 0.28, z, 0.23, 0.43, z + 0.045);
      box(0.77, 0.28, z, 0.84, 0.43, z + 0.045);
      box(0.23, 0.37, z, 0.77, 0.405, z + 0.045);
    }
    const rope = g.crop([7, 4, 1, 3]);
    for (const z of [0.14, 0.865])
      g.beam([0.18, 0.385, z], [0.875, 0.385, z], 0.025, skin);
    for (const x of [0.35, 0.63]) {
      const line: Point[] = [
        [x, 0.365, 0.12],
        [x, 0.414, 0.14],
        [x, 0.333, 0.23],
        [x, 0.333, 0.78],
        [x, 0.414, 0.865],
        [x, 0.365, 0.89],
      ];
      for (let i = 0; i < line.length - 1; i++)
        g.beam(line[i], line[i + 1], 0.009, rope);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        b = ((i + 1) / 12) * Math.PI * 2;
      g.beam(
        [0.875, 0.385 + Math.cos(a) * 0.06, 0.14 + Math.sin(a) * 0.06],
        [0.875, 0.385 + Math.cos(b) * 0.06, 0.14 + Math.sin(b) * 0.06],
        0.008,
        skin,
      );
    }
    g.beam([0.88, 0.385, 0.14], [0.88, 0.445, 0.14], 0.009, skin);
    g.beam([0.88, 0.445, 0.14], [0.95, 0.445, 0.14], 0.012, skin);
    g.face(
      [
        [0.23, 0.316, 0.22],
        [0.23, 0.316, 0.77],
        [0.77, 0.316, 0.77],
        [0.77, 0.316, 0.22],
      ],
      g.crop([17, 6, 9, 12]),
      1,
      undefined,
      true,
    );
  } else if (type === "displaycase") {
    g.lathe(
      [
        [0, 0],
        [0.43, 0],
        [0.43, 0.1],
        [0.4, 0.12],
        [0, 0.12],
      ],
      skin,
      undefined,
      8,
    );
    const rim = g.crop([12, 23, 10, 1]),
      glass = g.crop([10, 14, 12, 6]);
    const ring = (r: number, y: number) =>
      Array.from(
        { length: 8 },
        (_, i) =>
          [
            0.5 + Math.cos((i / 8) * Math.PI * 2) * r,
            y,
            0.5 + Math.sin((i / 8) * Math.PI * 2) * r,
          ] as Point,
      );
    const bottom = ring(0.4, 0.12),
      top = ring(0.33, 0.35);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8,
        start = g.faces.length;
      g.face(
        [top[i], bottom[i], bottom[j], top[j]],
        g.crop([11, 17, 2, 2]),
        1,
        undefined,
        true,
      );
      for (const f of g.faces.slice(start)) f.opacity = 0.22;
      const [x, y, z] = bottom[i],
        [X, Y, Z] = top[i];
      g.beam([x, y, z], [X, Y, Z], 0.01, rim);
      g.beam(top[i], top[j], 0.011, rim);
      const at = g.faces.length;
      g.face(
        [[0.5, 0.35, 0.5], top[i], top[j], [0.5, 0.35, 0.5]],
        glass,
        1,
        undefined,
        true,
      );
      for (const f of g.faces.slice(at)) {
        f.opacity = 0.28;
        f.uvs = Array.from({ length: 4 }, (_, v) => {
          const x = f.positions[v * 3] - o.x,
            z = f.positions[v * 3 + 2] - o.y;
          return [
            (glass.x + 0.25 + ((x - 0.17) / 0.66) * (glass.width - 0.5)) /
              glass.pageWidth,
            1 -
              (glass.y + 0.25 + ((z - 0.17) / 0.66) * (glass.height - 0.5)) /
                glass.pageHeight,
          ];
        }).flat();
      }
    }
  }
  return g.faces;
}
