import type { SceneryObject } from "../shared/model.js";
import {
  FurnitureGeometry,
  type Point,
  type Region,
} from "./furniture-geometry.js";
const types = new Set([
  "barrel",
  "bin",
  "bucket",
  "pot",
  "cage",
  "animaltrap",
  "weaponrack",
  "armorstand",
  "nestbox",
  "hive",
]);
export function storageFaces(o: SceneryObject, ground: number) {
  const type = o.furniture?.type;
  if (!type || !types.has(type) || !o.sprite) return;
  const g = new FurnitureGeometry(o, ground),
    material = o.furniture?.material;
  const regions: Record<string, Region> = {
    barrel: [13, 17, 8, 6],
    bin: [8, 19, 15, 3],
    bucket: [13, 20, 6, 4],
    pot:
      material === "wood"
        ? [9, 15, 14, 5]
        : material === "metal"
          ? [9, 15, 12, 5]
          : [15, 15, 8, 7],
    cage:
      material === "metal"
        ? [8, 4, 1, 7]
        : material === "glass"
          ? [19, 4, 6, 3]
          : [2, 4, 2, 7],
    animaltrap: [11, 19, 1, 5],
    weaponrack: [1, 15, 3, 10],
    armorstand: material === "wood" ? [13, 3, 5, 2] : [15, 16, 1, 1],
    nestbox: [8, 26, 16, 4],
    hive: [13, 11, 7, 6],
  };
  const core = g.crop(regions[type]);
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    skin = core,
  ) => g.box(x, y, z, X, Y, Z, skin);
  if (type === "barrel") {
    g.lathe(
      [
        [0, 0],
        [0.21, 0],
        [0.24, 0.065],
        [0.27, 0.24],
        [0.25, 0.44],
        [0.23, 0.5],
        [0.195, 0.5],
        [0.215, 0.44],
        [0.23, 0.24],
        [0.2, 0.05],
        [0, 0.05],
      ],
      core,
    );
    const hoop = g.crop([11, 13, 10, 2]);
    for (const [r, y] of [
      [0.255, 0.09],
      [0.264, 0.39],
    ])
      g.lathe(
        [
          [r - 0.008, y],
          [r + 0.008, y + 0.008],
          [r + 0.008, y + 0.036],
          [r - 0.008, y + 0.044],
        ],
        hoop,
      );
  } else if (type === "bin") {
    box(0.16, 0, 0.2, 0.84, 0.045, 0.8);
    box(0.16, 0.045, 0.2, 0.21, 0.35, 0.8);
    box(0.79, 0.045, 0.2, 0.84, 0.35, 0.8);
    box(0.21, 0.045, 0.2, 0.79, 0.35, 0.25);
    box(0.21, 0.045, 0.75, 0.79, 0.35, 0.8);
    for (const z of [0.18, 0.76]) box(0.14, 0.32, z, 0.86, 0.365, z + 0.06);
    for (const x of [0.14, 0.8]) box(x, 0.32, 0.24, x + 0.06, 0.365, 0.76);
    const lip = g.crop([8, 13, 15, 1]);
    for (const z of [0.18, 0.76])
      box(0.14, 0.365, z, 0.86, 0.371, z + 0.06, lip);
    for (const x of [0.14, 0.8])
      box(x, 0.365, 0.24, x + 0.06, 0.371, 0.76, lip);
    for (const x of [0.17, 0.79])
      for (const z of [0.2, 0.75]) box(x, 0.04, z, x + 0.04, 0.32, z + 0.05);
  } else if (type === "bucket") {
    g.lathe(
      [
        [0, 0],
        [0.13, 0],
        [0.2, 0.26],
        [0.17, 0.26],
        [0.11, 0.04],
        [0, 0.04],
      ],
      core,
    );
    const metal = g.crop([12, 17, 7, 1]);
    if (material === "wood")
      for (const [r, y] of [
        [0.16, 0.06],
        [0.198, 0.21],
      ])
        g.lathe(
          [
            [r - 0.006, y],
            [r + 0.004, y],
            [r + 0.004, y + 0.018],
            [r - 0.006, y + 0.018],
          ],
          metal,
        );
    // A thin segmented arch gives the native bail its rounded silhouette.
    const points: Point[] = Array.from({ length: 13 }, (_, i) => [
      0.5 + Math.cos((i / 12) * Math.PI) * 0.2,
      0.24 + Math.sin((i / 12) * Math.PI) * 0.2,
      0.5,
    ]);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy),
        nx = (-dy / len) * 0.009,
        ny = (dx / len) * 0.009;
      g.face(
        [
          [a[0] + nx, a[1] + ny, 0.489],
          [a[0] - nx, a[1] - ny, 0.489],
          [b[0] - nx, b[1] - ny, 0.489],
          [b[0] + nx, b[1] + ny, 0.489],
        ],
        metal,
      );
      g.face(
        [
          [b[0] + nx, b[1] + ny, 0.511],
          [b[0] - nx, b[1] - ny, 0.511],
          [a[0] - nx, a[1] - ny, 0.511],
          [a[0] + nx, a[1] + ny, 0.511],
        ],
        metal,
      );
      for (const sign of [-1, 1])
        g.face(
          [
            [a[0] + nx * sign, a[1] + ny * sign, 0.489],
            [a[0] + nx * sign, a[1] + ny * sign, 0.511],
            [b[0] + nx * sign, b[1] + ny * sign, 0.511],
            [b[0] + nx * sign, b[1] + ny * sign, 0.489],
          ],
          metal,
        );
    }
  } else if (type === "pot") {
    g.lathe(
      [
        [0, 0],
        [0.15, 0],
        [0.24, 0.09],
        [0.27, 0.25],
        [0.22, 0.38],
        [0.16, 0.42],
        [0.17, 0.46],
        [0.13, 0.46],
        [0.13, 0.415],
        [0.18, 0.37],
        [0.23, 0.25],
        [0.2, 0.1],
        [0, 0.05],
      ],
      core,
    );
    if (material !== "stone")
      g.lathe(
        [
          [0.17, 0.451],
          [0.173, 0.456],
          [0.173, 0.465],
          [0.13, 0.465],
          [0.13, 0.455],
        ],
        g.crop([11, 12, 12, 1]),
      );
  } else if (type === "cage" || type === "animaltrap") {
    const small = type === "animaltrap",
      l = small ? 0.26 : 0.14,
      r = 1 - l,
      h = small ? 0.3 : 0.66,
      w = small ? 0.018 : 0.022;
    box(
      l,
      0,
      l,
      r,
      0.045,
      r,
      g.crop(
        type === "animaltrap"
          ? [11, 19, 1, 1]
          : material === "wood"
            ? [2, 5, 1, 1]
            : material === "metal"
              ? [8, 5, 1, 1]
              : [8, 20, 1, 1],
      ),
    );
    for (const y of [0.045, h - 0.035]) {
      box(l, y, l, r, y + 0.035, l + 0.035);
      box(l, y, r - 0.035, r, y + 0.035, r);
      box(l, y, l, l + 0.035, y + 0.035, r);
      box(r - 0.035, y, l, r, y + 0.035, r);
    }
    const highlight = g.crop(
      small
        ? [15, 16, 1, 1]
        : material === "glass"
          ? [6, 1, 1, 1]
          : [2, 2, 1, 1],
    );
    for (const z of [l, r - 0.035])
      box(l, h - 0.004, z, r, h + 0.002, z + 0.035, highlight);
    for (const x of [l, r - 0.035])
      box(x, h - 0.004, l + 0.035, x + 0.035, h + 0.002, r - 0.035, highlight);
    const glazed = type === "cage" && material === "glass";
    for (let i = 0; i <= (glazed ? 2 : 5); i++) {
      const q = l + ((r - l - w) * i) / (glazed ? 2 : 5);
      box(q, 0.045, l, q + w, h, l + w);
      box(q, 0.045, r - w, q + w, h, r);
      box(l, 0.045, q, l + w, h, q + w);
      box(r - w, 0.045, q, r, h, q + w);
      box(q, h - 0.022, l, q + w, h, r);
    }
    if (glazed) {
      const glass = g.crop([8, 20, 6, 5]),
        glare = g.crop([5, 3, 22, 10]);
      for (const p of [
        [
          [l, h, l],
          [l, 0.045, l],
          [r, 0.045, l],
          [r, h, l],
        ],
        [
          [r, h, r],
          [r, 0.045, r],
          [l, 0.045, r],
          [l, h, r],
        ],
        [
          [l, h, r],
          [l, 0.045, r],
          [l, 0.045, l],
          [l, h, l],
        ],
        [
          [r, h, l],
          [r, 0.045, l],
          [r, 0.045, r],
          [r, h, r],
        ],
        [
          [l, h, l],
          [l, h, r],
          [r, h, r],
          [r, h, l],
        ],
      ] as Point[][]) {
        const start = g.faces.length;
        g.face(p, p[0][1] === p[1][1] ? glare : glass, 1, undefined, true);
        for (const f of g.faces.slice(start)) f.opacity = 0.36;
      }
    }
    if (small) {
      box(0.3, 0.06, 0.725, 0.7, 0.085, 0.75);
    }
  } else if (type === "weaponrack") {
    box(
      0.16,
      0,
      0.3,
      0.84,
      0.05,
      0.7,
      g.crop(material === "metal" ? [2, 15, 1, 1] : [2, 18, 1, 4]),
    );
    for (const x of [0.19, 0.75]) box(x, 0.05, 0.4, x + 0.06, 0.62, 0.5);
    for (const y of [0.19, 0.4, 0.58])
      box(0.19, y, 0.41, 0.81, y + 0.035, 0.49);
    for (let i = 0; i < 5; i++) {
      const x = 0.27 + i * 0.11;
      box(x, 0.42, 0.49, x + 0.025, 0.47, 0.59);
    }
  } else if (type === "armorstand") {
    box(0.27, 0, 0.29, 0.73, 0.055, 0.71, g.crop([15, 10, 1, 3]));
    for (const x of [0.35, 0.61]) {
      box(x, 0.055, 0.45, x + 0.04, 0.22, 0.53);
      box(x - 0.03, 0.055, 0.53, x + 0.07, 0.08, 0.65);
    }
    box(0.465, 0.055, 0.465, 0.535, 0.57, 0.535);
    box(0.3, 0.4, 0.46, 0.7, 0.445, 0.54);
    box(0.38, 0.25, 0.46, 0.62, 0.28, 0.54);
    box(0.43, 0.57, 0.43, 0.57, 0.65, 0.57, g.crop([13, 3, 5, 2]));
    if (material !== "wood")
      for (const [x, X, y] of [
        [0.3, 0.7, 0.445],
        [0.38, 0.62, 0.28],
      ])
        box(x, y - 0.004, 0.46, X, y + 0.002, 0.54, g.crop([12, 12, 1, 1]));
    box(0.45, 0.65, 0.45, 0.55, 0.67, 0.55);
  } else if (type === "nestbox") {
    box(0.2, 0, 0.2, 0.8, 0.05, 0.8);
    box(0.2, 0.05, 0.2, 0.25, 0.19, 0.8);
    box(0.75, 0.05, 0.2, 0.8, 0.19, 0.8);
    box(0.25, 0.05, 0.2, 0.75, 0.19, 0.25);
    box(0.25, 0.05, 0.75, 0.75, 0.19, 0.8);
    const rim = g.crop([8, 25, 16, 1]);
    for (const z of [0.2, 0.75]) box(0.2, 0.18, z, 0.8, 0.195, z + 0.05, rim);
    for (const x of [0.2, 0.75]) box(x, 0.18, 0.25, x + 0.05, 0.195, 0.75, rim);
    const straw = g.crop([10, 17, 12, 5]);
    g.lathe(
      [
        [0, 0.055],
        [0.14, 0.055],
        [0.235, 0.14],
        [0.22, 0.18],
        [0.18, 0.17],
        [0.12, 0.115],
        [0, 0.1],
      ],
      straw,
      undefined,
      12,
    );
    for (let i = 0; i < 13; i++) {
      const a = i * 2.399,
        r = 0.13 + (i % 3) * 0.026,
        x = 0.5 + Math.cos(a) * r,
        z = 0.5 + Math.sin(a) * r,
        dx = Math.cos(a + 0.7) * 0.023,
        dz = Math.sin(a + 0.7) * 0.023,
        h = 0.205 + (i % 4) * 0.009;
      g.face(
        [
          [x - dx, 0.125, z - dz],
          [x + dx, 0.125, z + dz],
          [
            x + dx * 0.4 + Math.cos(a) * 0.035,
            h,
            z + dz * 0.4 + Math.sin(a) * 0.035,
          ],
          [
            x - dx * 0.4 + Math.cos(a) * 0.035,
            h,
            z - dz * 0.4 + Math.sin(a) * 0.035,
          ],
        ],
        straw,
      );
    }
  } else if (type === "hive") {
    const timber = g.crop([10, 27, 12, 1]);
    box(0.17, 0, 0.17, 0.83, 0.04, 0.83, timber);
    for (const x of [0.19, 0.77])
      box(x, 0.04, 0.45, x + 0.04, 0.36, 0.53, g.crop([6, 17, 1, 4]));
    g.lathe(
      [
        [0, 0.04],
        [0.25, 0.04],
        [0.27, 0.09],
        [0.26, 0.2],
        [0.23, 0.33],
        [0.18, 0.43],
        [0.11, 0.51],
        [0.04, 0.55],
        [0.04, 0.58],
        [0, 0.58],
      ],
      core,
    );
    const weave = g.crop([12, 17, 8, 2]);
    for (const [r, y] of [
      [0.266, 0.1],
      [0.253, 0.21],
      [0.224, 0.33],
      [0.174, 0.44],
    ])
      g.lathe(
        [
          [r, y],
          [r + 0.008, y + 0.009],
          [r, y + 0.018],
        ],
        weave,
      );
    g.box(0.465, 0.08, 0.759, 0.535, 0.145, 0.765, undefined, [43, 31, 18]);
  }
  return g.faces;
}
