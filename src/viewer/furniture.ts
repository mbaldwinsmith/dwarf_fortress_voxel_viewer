import type { SceneryObject, SpriteRef } from "../shared/model.js";
import { storageFaces } from "./storage-models.js";
export interface FurnitureFace {
  uvs?: number[];
  positions: number[];
  sprite?: SpriteRef;
  palette?: SceneryObject["palette"];
  tint?: [number, number, number];
  brightness: number;
}
// Interior regions of vanilla 32px furniture art: no baked perspective or legs.
const crop = (
  r: SpriteRef,
  x: number,
  y: number,
  w: number,
  h: number,
): SpriteRef => ({
  ...r,
  x: r.x + (x * r.width) / 32,
  y: r.y + (y * r.height) / 32,
  width: (w * r.width) / 32,
  height: (h * r.height) / 32,
});
export function furnitureFaces(
  o: SceneryObject,
  ground: number,
): FurnitureFace[] {
  if (!o.furniture || !o.sprite) return [];
  const storage = storageFaces(o, ground);
  if (storage) return storage;
  const faces: FurnitureFace[] = [],
    type = o.furniture.type;
  const wood = crop(
    o.sprite,
    ...((type === "table"
      ? [5, 4, 22, 15]
      : type === "chair"
        ? [11, 12, 10, 6]
        : type === "cabinet" || type === "bookcase"
          ? [7, 4, 18, 4]
          : type === "coffin"
            ? [12, 6, 8, 16]
            : type === "chest"
              ? [8, 10, 16, 7]
              : [10, 5, 12, 20]) as [number, number, number, number]),
  );
  const add = (
    points: number[][],
    sprite: SpriteRef | undefined,
    tint: [number, number, number] | undefined,
    brightness: number,
    palette?: SceneryObject["palette"],
  ) => {
    faces.push({
      positions: points.flatMap(([x, y, z]) => [o.x + x, ground + y, o.y + z]),
      sprite,
      tint,
      brightness,
      palette,
    });
  };
  const box = (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    texture: SpriteRef | null = wood,
    tint?: [number, number, number],
    palette: SceneryObject["palette"] = o.palette,
  ) => {
    const sprite = texture ?? undefined;
    add(
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      sprite,
      tint,
      1,
      palette,
    );
    add(
      [
        [x0, y0, z1],
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
      ],
      sprite,
      tint,
      0.48,
      palette,
    );
    add(
      [
        [x0, y1, z1],
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
      ],
      sprite,
      tint,
      0.82,
      palette,
    );
    add(
      [
        [x1, y1, z0],
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
      ],
      sprite,
      tint,
      0.68,
      palette,
    );
    add(
      [
        [x0, y1, z0],
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
      ],
      sprite,
      tint,
      0.74,
      palette,
    );
    add(
      [
        [x1, y1, z1],
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
      ],
      sprite,
      tint,
      0.88,
      palette,
    );
  };
  const legs = (
    left: number,
    right: number,
    near: number,
    far: number,
    thickness: number,
    height: number,
  ) => {
    for (const x of [left, right])
      for (const z of [near, far])
        box(x, 0, z, x + thickness, height, z + thickness);
  };
  if (type === "table") {
    legs(0.15, 0.75, 0.16, 0.73, 0.1, 0.48);
    box(0.09, 0.48, 0.1, 0.91, 0.57, 0.9);
  } else if (type === "chair") {
    // Compact, rotationally symmetric seating; no implied facing direction.
    if (o.furniture.heavy) box(0.32, 0, 0.32, 0.68, 0.27, 0.68);
    else legs(0.3, 0.62, 0.3, 0.62, 0.08, 0.27);
    box(0.27, 0.27, 0.27, 0.73, 0.35, 0.73);
  } else if (type === "chest") {
    box(0.17, 0, 0.29, 0.83, 0.07, 0.71);
    box(0.15, 0.07, 0.27, 0.85, 0.35, 0.73);
    box(0.13, 0.35, 0.25, 0.87, 0.43, 0.75);
    box(0.475, 0.25, 0.75, 0.525, 0.385, 0.78, null, [150, 142, 111]);
  } else if (type === "cabinet") {
    legs(0.17, 0.75, 0.23, 0.59, 0.08, 0.08);
    box(0.13, 0.08, 0.2, 0.87, 0.77, 0.67);
    box(0.11, 0.77, 0.18, 0.89, 0.83, 0.69);
    // Separate raised door leaves with the native front/handle artwork.
    box(0.17, 0.12, 0.67, 0.49, 0.73, 0.69);
    box(0.51, 0.12, 0.67, 0.83, 0.73, 0.69);
    for (const [left, right, sx] of [
      [0.17, 0.49, 5],
      [0.51, 0.83, 17],
    ])
      add(
        [
          [left, 0.73, 0.692],
          [left, 0.12, 0.692],
          [right, 0.12, 0.692],
          [right, 0.73, 0.692],
        ],
        crop(o.sprite, sx, 11, 10, 16),
        undefined,
        0.9,
        o.palette,
      );
  } else if (type === "bookcase") {
    box(0.13, 0, 0.17, 0.87, 0.07, 0.67);
    box(0.13, 0.07, 0.17, 0.21, 0.79, 0.67);
    box(0.79, 0.07, 0.17, 0.87, 0.79, 0.67);
    box(0.21, 0.07, 0.17, 0.79, 0.79, 0.23);
    box(0.11, 0.79, 0.15, 0.89, 0.85, 0.69);
    for (const y of [0.29, 0.54]) box(0.21, y, 0.23, 0.79, y + 0.045, 0.67);
    // Native book/shelf detail sits at the back of real recessed shelf openings.
    add(
      [
        [0.21, 0.79, 0.232],
        [0.21, 0.07, 0.232],
        [0.79, 0.07, 0.232],
        [0.79, 0.79, 0.232],
      ],
      crop(o.sprite, 6, 10, 20, 17),
      undefined,
      0.85,
      o.palette,
    );
  } else if (type === "coffin") {
    const outline = [
      [0.32, 0.08],
      [0.68, 0.08],
      [0.82, 0.3],
      [0.68, 0.92],
      [0.32, 0.92],
      [0.18, 0.3],
    ];
    for (let i = 0; i < outline.length; i++) {
      const [x, z] = outline[i],
        [nx, nz] = outline[(i + 1) % outline.length];
      add(
        [
          [x, 0.31, z],
          [x, 0, z],
          [nx, 0, nz],
          [nx, 0.31, nz],
        ],
        wood,
        undefined,
        0.72 + 0.05 * (i % 3),
        o.palette,
      );
      add(
        [
          [x, 0.38, z],
          [x, 0.31, z],
          [nx, 0.31, nz],
          [nx, 0.38, nz],
        ],
        wood,
        undefined,
        0.88,
        o.palette,
      );
    }
    // Continuous planar UVs across the shoulder and lower trapezoids.
    const lid = crop(o.sprite, 9, 3, 14, 23);
    for (const [points, y, brightness] of [
      [
        [
          [0.32, 0.08],
          [0.18, 0.3],
          [0.82, 0.3],
          [0.68, 0.08],
        ],
        0.38,
        1,
      ],
      [
        [
          [0.18, 0.3],
          [0.32, 0.92],
          [0.68, 0.92],
          [0.82, 0.3],
        ],
        0.38,
        1,
      ],
      [
        [
          [0.32, 0.08],
          [0.18, 0.3],
          [0.82, 0.3],
          [0.68, 0.08],
        ],
        0,
        0.48,
      ],
      [
        [
          [0.18, 0.3],
          [0.32, 0.92],
          [0.68, 0.92],
          [0.82, 0.3],
        ],
        0,
        0.48,
      ],
    ] as [number[][], number, number][]) {
      add(
        points.map(([x, z]) => [x, y, z]),
        lid,
        undefined,
        brightness,
        o.palette,
      );
      faces[faces.length - 1].uvs = points.flatMap(([x, z]) => [
        (lid.x + ((x - 0.18) / 0.64) * lid.width) / lid.pageWidth,
        1 - (lid.y + ((z - 0.08) / 0.84) * lid.height) / lid.pageHeight,
      ]);
    }
  } else {
    legs(0.18, 0.73, 0.12, 0.8, 0.09, 0.2);
    box(0.17, 0.17, 0.08, 0.83, 0.27, 0.92);
    box(0.17, 0.27, 0.06, 0.83, 0.52, 0.14);
    box(0.17, 0.27, 0.86, 0.83, 0.36, 0.94);
    // Opaque mattress/blanket/pillow volumes close all sides below native details.
    box(0.22, 0.27, 0.15, 0.78, 0.37, 0.86, null, [222, 215, 193]);
    const sheet = o.details?.[0],
      pillow = o.details?.[1];
    box(
      0.215,
      0.33,
      0.39,
      0.785,
      0.4,
      0.86,
      null,
      sheet?.tint ?? [190, 206, 184],
    );
    box(0.29, 0.37, 0.18, 0.71, 0.445, 0.34, null, [245, 239, 219]);
    if (sheet)
      add(
        [
          [0.215, 0.402, 0.39],
          [0.215, 0.402, 0.86],
          [0.785, 0.402, 0.86],
          [0.785, 0.402, 0.39],
        ],
        crop(sheet.sprite, 8, 8, 16, 14),
        sheet.tint,
        sheet.brightness ?? 1,
      );
    if (pillow)
      add(
        [
          [0.29, 0.447, 0.18],
          [0.29, 0.447, 0.34],
          [0.71, 0.447, 0.34],
          [0.71, 0.447, 0.18],
        ],
        crop(pillow.sprite, 16, 5, 4, 3),
        pillow.tint,
        1,
      );
  }
  return faces;
}
