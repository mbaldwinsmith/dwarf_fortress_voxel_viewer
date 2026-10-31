import type { SceneryObject, SpriteRef } from "../shared/model.js";
import { storageFaces } from "./storage-models.js";
import { barrierFaces } from "./barrier-models.js";
import { FurnitureGeometry } from "./furniture-geometry.js";
import { displayFurnitureFaces } from "./display-furniture.js";
export interface FurnitureFace {
  uvs?: number[];
  positions: number[];
  sprite?: SpriteRef;
  palette?: SceneryObject["palette"];
  tint?: [number, number, number];
  brightness: number;
  opacity?: number;
}
export function furnitureFaces(
  o: SceneryObject,
  ground: number,
  axisZ = false,
): FurnitureFace[] {
  if (!o.furniture || !o.sprite) return [];
  const other =
    barrierFaces(o, ground, axisZ) ??
    storageFaces(o, ground) ??
    displayFurnitureFaces(o, ground);
  if (other) return other;
  const g = new FurnitureGeometry(o, ground),
    type = o.furniture.type;
  const material =
    o.furniture.material ?? (o.furniture.heavy ? "stone" : "wood");
  const polished = material === "metal" || material === "glass";
  const wood = g.crop(
    type === "table"
      ? polished
        ? [11, 2, 4, 4]
        : [6, 5, 20, 14]
      : type === "chair"
        ? polished
          ? [19, 17, 3, 2]
          : [11, 12, 10, 6]
        : type === "bed"
          ? [11, 4, 10, 5]
          : type === "coffin"
            ? material === "wood"
              ? [11, 24, 10, 5]
              : [12, 26, 8, 4]
            : type === "chest"
              ? material === "glass"
                ? [12, 21, 8, 3]
                : material === "metal"
                  ? [9, 20, 13, 4]
                  : [8, 20, 15, 4]
              : type === "cabinet"
                ? polished
                  ? [17, 13, 6, 5]
                  : [7, 20, 1, 1]
                : material !== "wood"
                  ? material === "stone"
                    ? [4, 13, 1, 1]
                    : [4, 13, 1, 4]
                  : [5, 3, 22, 5],
  );
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    skin = wood,
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
      material === "wood" && Y - y > Math.max(X - x, Z - z),
    );
  const legs = (
    l: number,
    r: number,
    n: number,
    f: number,
    w: number,
    h: number,
  ) => {
    for (const x of [l, r])
      for (const z of [n, f]) box(x, 0, z, x + w, h, z + w);
  };
  if (type === "table") {
    legs(0.15, 0.755, 0.16, 0.745, 0.075, 0.35);
    box(0.14, 0.3, 0.17, 0.84, 0.35, 0.21);
    box(0.14, 0.3, 0.76, 0.84, 0.35, 0.8);
    box(0.15, 0.3, 0.2, 0.19, 0.35, 0.78);
    box(0.79, 0.3, 0.2, 0.83, 0.35, 0.78);
    box(0.09, 0.35, 0.1, 0.91, 0.385, 0.9);
    box(0.09, 0.38, 0.1, 0.91, 0.387, 0.9, g.crop([2, 2, 1, 1]));
    box(0.105, 0.387, 0.115, 0.895, 0.4, 0.885);
    g.face(
      [
        [0.105, 0.4002, 0.115],
        [0.105, 0.4002, 0.885],
        [0.895, 0.4002, 0.885],
        [0.895, 0.4002, 0.115],
      ],
      g.crop([3, 2, 25, 21]),
      1,
      undefined,
      true,
    );
  } else if (type === "chair") {
    if (o.furniture.heavy) box(0.33, 0, 0.33, 0.67, 0.195, 0.67);
    else legs(0.3, 0.635, 0.3, 0.635, 0.065, 0.195);
    box(0.27, 0.195, 0.27, 0.73, 0.225, 0.73);
    box(0.27, 0.221, 0.27, 0.73, 0.228, 0.73, g.crop([9, 12, 1, 1]));
    box(0.28, 0.228, 0.28, 0.72, 0.24, 0.72);
    g.face(
      [
        [0.28, 0.2402, 0.28],
        [0.28, 0.2402, 0.72],
        [0.72, 0.2402, 0.72],
        [0.72, 0.2402, 0.28],
      ],
      g.crop([8, 12, 15, 7]),
      1,
      undefined,
      true,
    );
  } else if (type === "cabinet") {
    legs(0.18, 0.755, 0.28, 0.565, 0.065, 0.055);
    box(0.14, 0.055, 0.25, 0.86, 0.63, 0.65);
    box(0.12, 0.63, 0.23, 0.88, 0.67, 0.67);
    g.face(
      [
        [0.12, 0.6702, 0.23],
        [0.12, 0.6702, 0.67],
        [0.88, 0.6702, 0.67],
        [0.88, 0.6702, 0.23],
      ],
      g.crop([5, 3, 22, 5]),
      1,
      undefined,
      true,
    );
    for (const [l, r, sx] of [
      [0.18, 0.49, 5],
      [0.51, 0.82, 17],
    ]) {
      box(l, 0.105, 0.65, r, 0.6, 0.668);
      g.face(
        [
          [l, 0.6, 0.67],
          [l, 0.105, 0.67],
          [r, 0.105, 0.67],
          [r, 0.6, 0.67],
        ],
        g.crop([sx, 11, 10, 16]),
        0.96,
        undefined,
        true,
      );
    }
  } else if (type === "bookcase") {
    box(0.14, 0, 0.29, 0.86, 0.055, 0.66);
    box(0.14, 0.055, 0.29, 0.205, 0.65, 0.66);
    box(0.795, 0.055, 0.29, 0.86, 0.65, 0.66);
    box(0.205, 0.055, 0.29, 0.795, 0.65, 0.34);
    box(0.12, 0.65, 0.27, 0.88, 0.69, 0.68);
    g.face(
      [
        [0.12, 0.6902, 0.27],
        [0.12, 0.6902, 0.68],
        [0.88, 0.6902, 0.68],
        [0.88, 0.6902, 0.27],
      ],
      g.crop([5, 3, 22, 5]),
      1,
      undefined,
      true,
    );
    box(0.205, 0.345, 0.34, 0.795, 0.38, 0.66);
    for (const [y, Y, sy] of [
      [0.075, 0.335, 20],
      [0.39, 0.635, 11],
    ])
      g.face(
        [
          [0.205, Y, 0.53],
          [0.205, y, 0.53],
          [0.795, y, 0.53],
          [0.795, Y, 0.53],
        ],
        g.crop([6, sy, 20, 6]),
        0.95,
        undefined,
        true,
      );
  } else if (type === "chest") {
    box(0.18, 0, 0.29, 0.82, 0.04, 0.71);
    box(0.15, 0.04, 0.27, 0.85, 0.255, 0.73);
    box(0.13, 0.255, 0.25, 0.87, 0.29, 0.75);
    box(0.145, 0.29, 0.265, 0.855, 0.305, 0.735);
    g.face(
      [
        [0.145, 0.3052, 0.265],
        [0.145, 0.3052, 0.735],
        [0.855, 0.3052, 0.735],
        [0.855, 0.3052, 0.265],
      ],
      g.crop(material === "glass" ? [8, 9, 15, 6] : [8, 8, 15, 4]),
      1,
      undefined,
      true,
    );
    g.box(0.478, 0.19, 0.75, 0.522, 0.285, 0.765, g.crop([15, 22, 2, 3]));
  } else if (type === "coffin") {
    const outline = [
      [0.32, 0.08],
      [0.68, 0.08],
      [0.82, 0.3],
      [0.68, 0.92],
      [0.32, 0.92],
      [0.18, 0.3],
    ];
    let along = 0;
    for (let i = 0; i < outline.length; i++) {
      const [x, z] = outline[i],
        [X, Z] = outline[(i + 1) % outline.length];
      for (const [y, Y, shade] of [
        [0, 0.23, 0.83],
        [0.23, 0.27, 0.97],
      ])
        g.face(
          [
            [x, Y, z],
            [x, y, z],
            [X, y, Z],
            [X, Y, Z],
          ].map(
            ([a, b, c]) =>
              [
                0.5 + (a - 0.5) * (y >= 0.23 ? 1.045 : 1),
                b,
                0.5 + (c - 0.5) * (y >= 0.23 ? 1.045 : 1),
              ] as [number, number, number],
          ),
          wood,
          shade,
          undefined,
          false,
          o.palette,
          [along * 32, 0],
        );
      along += Math.hypot(X - x, Z - z);
    }
    const lid = g.crop([11, 3, 10, 16]);
    for (const y of [0, 0.23, 0.27])
      for (const points of [
        [
          [0.32, 0.08],
          [0.18, 0.3],
          [0.82, 0.3],
          [0.68, 0.08],
        ],
        [
          [0.18, 0.3],
          [0.32, 0.92],
          [0.68, 0.92],
          [0.82, 0.3],
        ],
      ]) {
        const p = points.map(([x, z]) => [
          o.x + 0.5 + (x - 0.5) * (y >= 0.23 ? 1.045 : 1),
          ground + y,
          o.y + 0.5 + (z - 0.5) * (y >= 0.23 ? 1.045 : 1),
        ]);
        g.faces.push({
          positions: p.flat(),
          sprite: lid,
          palette: o.palette,
          brightness: y ? 1 : 0.62,
          uvs: points.flatMap(([x, z]) => [
            (lid.x + 0.25 + ((x - 0.18) / 0.64) * (lid.width - 0.5)) /
              lid.pageWidth,
            1 -
              (lid.y + 0.25 + ((z - 0.08) / 0.84) * (lid.height - 0.5)) /
                lid.pageHeight,
          ]),
        });
      }
  } else if (type === "bed") {
    legs(0.18, 0.755, 0.12, 0.815, 0.065, 0.135);
    box(0.17, 0.12, 0.08, 0.83, 0.18, 0.92);
    box(0.17, 0.18, 0.06, 0.83, 0.4, 0.12);
    box(0.17, 0.18, 0.88, 0.83, 0.27, 0.94);
    g.box(0.22, 0.18, 0.15, 0.78, 0.265, 0.86, undefined, [222, 215, 193]);
    const sheet = o.details?.[0],
      pillow = o.details?.[1];
    g.box(
      0.215,
      0.195,
      0.39,
      0.785,
      0.28,
      0.86,
      undefined,
      sheet?.tint ?? [190, 206, 184],
    );
    g.box(0.29, 0.265, 0.18, 0.71, 0.305, 0.34, undefined, [236, 232, 215]);
    if (sheet)
      g.face(
        [
          [0.215, 0.281, 0.39],
          [0.215, 0.281, 0.86],
          [0.785, 0.281, 0.86],
          [0.785, 0.281, 0.39],
        ],
        g.crop([8, 8, 16, 14], sheet.sprite),
        sheet.brightness ?? 1,
        sheet.tint,
        true,
        sheet.palette,
      );
    if (pillow)
      g.face(
        [
          [0.29, 0.306, 0.18],
          [0.29, 0.306, 0.34],
          [0.71, 0.306, 0.34],
          [0.71, 0.306, 0.18],
        ],
        g.crop([13, 5, 5, 3], pillow.sprite),
        1,
        pillow.tint,
        true,
        pillow.palette,
      );
  }
  return g.faces;
}
