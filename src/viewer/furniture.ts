import type { SceneryObject, SpriteRef } from "../shared/model.js";
export interface FurnitureFace {
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
  const faces: FurnitureFace[] = [],
    type = o.furniture.type;
  const wood = crop(
    o.sprite,
    ...((type === "table"
      ? [5, 4, 22, 15]
      : type === "chair"
        ? [11, 12, 10, 6]
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
    const thick = o.furniture.heavy ? 0.15 : 0.09;
    legs(0.23, 0.77 - thick, 0.24, 0.76 - thick, thick, 0.35);
    box(0.2, 0.35, 0.2, 0.8, 0.44, 0.8);
    box(0.2, 0.44, 0.18, 0.8, 0.84, 0.29);
    if (o.furniture.heavy) {
      box(0.2, 0.44, 0.3, 0.29, 0.59, 0.73);
      box(0.71, 0.44, 0.3, 0.8, 0.59, 0.73);
    } else {
      box(0.23, 0.16, 0.25, 0.29, 0.23, 0.74);
      box(0.71, 0.16, 0.25, 0.77, 0.23, 0.74);
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
