import type { SceneryObject, SpriteRef } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";
const types = new Set([
  "door",
  "hatch",
  "gratefloor",
  "gratewall",
  "floodgate",
]);
export function barrierFaces(
  o: SceneryObject,
  ground: number,
  axisZ = false,
): FurnitureFace[] | undefined {
  const type = o.furniture?.type;
  if (!type || !types.has(type) || !o.sprite) return;
  const faces: FurnitureFace[] = [],
    r = o.sprite,
    open = !!o.furniture?.open;
  const color =
    o.furniture?.color ?? ([136, 126, 107] as [number, number, number]);
  const crop = (x: number, y: number, w: number, h: number): SpriteRef => ({
    ...r,
    x: r.x + (x * r.width) / 32,
    y: r.y + (y * r.height) / 32,
    width: (w * r.width) / 32,
    height: (h * r.height) / 32,
  });
  const add = (points: number[][], texture?: SpriteRef, shade = 1) =>
    faces.push({
      positions: points.flatMap(([x, y, z]) => [
        o.x + (axisZ ? 1 - z : x),
        ground + y,
        o.y + (axisZ ? x : z),
      ]),
      sprite: texture,
      palette: texture ? o.palette : undefined,
      tint: texture ? undefined : color,
      brightness: shade,
    });
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    texture?: SpriteRef,
  ) => {
    add(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      texture,
    );
    add(
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      texture,
      0.5,
    );
    add(
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      texture,
      0.9,
    );
    add(
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      texture,
      0.72,
    );
    add(
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      texture,
      0.75,
    );
    add(
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
      texture,
      0.85,
    );
  };
  // Native perspective sprites can contain transparent pixels. Solid cores
  // keep those pixels from punching holes through a closed panel.
  const panelBox = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    texture: SpriteRef,
    axis: "x" | "y" | "z",
  ) => {
    box(x, y, z, X, Y, Z);
    const d = 0.001;
    if (axis === "z") {
      add(
        [
          [x, Y, Z + d],
          [x, y, Z + d],
          [X, y, Z + d],
          [X, Y, Z + d],
        ],
        texture,
        0.95,
      );
      add(
        [
          [X, Y, z - d],
          [X, y, z - d],
          [x, y, z - d],
          [x, Y, z - d],
        ],
        texture,
        0.85,
      );
    } else if (axis === "x") {
      add(
        [
          [X + d, Y, Z],
          [X + d, y, Z],
          [X + d, y, z],
          [X + d, Y, z],
        ],
        texture,
        0.95,
      );
      add(
        [
          [x - d, Y, z],
          [x - d, y, z],
          [x - d, y, Z],
          [x - d, Y, Z],
        ],
        texture,
        0.85,
      );
    } else {
      add(
        [
          [x, Y + d, z],
          [x, Y + d, Z],
          [X, Y + d, Z],
          [X, Y + d, z],
        ],
        texture,
      );
      add(
        [
          [x, y - d, Z],
          [x, y - d, z],
          [X, y - d, z],
          [X, y - d, Z],
        ],
        texture,
        0.7,
      );
    }
  };
  const frame = (vertical: boolean) => {
    if (vertical) {
      box(0.02, 0, 0.1, 0.09, 0.86, 0.24);
      box(0.91, 0, 0.1, 0.98, 0.86, 0.24);
      box(0.09, 0.79, 0.1, 0.91, 0.86, 0.24);
    } else {
      box(0.02, 0, 0.02, 0.98, 0.05, 0.09);
      box(0.02, 0, 0.91, 0.98, 0.05, 0.98);
      box(0.02, 0, 0.09, 0.09, 0.05, 0.91);
      box(0.91, 0, 0.09, 0.98, 0.05, 0.91);
    }
  };
  if (type === "door") {
    frame(true);
    const panel = crop(5, 3, 22, 25);
    if (open) {
      panelBox(0.095, 0, 0.24, 0.165, 0.78, 0.98, panel, "x");
    } else {
      panelBox(0.095, 0, 0.145, 0.905, 0.78, 0.215, panel, "z");
    }
  } else if (type === "floodgate") {
    frame(true);
    if (!open)
      panelBox(0.09, 0, 0.13, 0.91, 0.79, 0.22, crop(5, 5, 22, 21), "z");
    // Open floodgates retract into the header rather than spanning the opening.
  } else if (type === "hatch") {
    frame(false);
    const panel = crop(6, 5, 20, 21);
    if (open) panelBox(0.095, 0.05, 0.095, 0.905, 0.79, 0.16, panel, "z");
    else panelBox(0.095, 0, 0.095, 0.905, 0.065, 0.905, panel, "y");
  } else {
    const vertical = type === "gratewall";
    frame(vertical);
    if (!open) {
      // Individual bars leave actual gaps, rather than textured transparent quads.
      if (vertical) {
        for (let i = 0; i < 7; i++) {
          const x = 0.15 + i * 0.11;
          box(x, 0, 0.15, x + 0.028, 0.79, 0.2);
        }
        for (const y of [0.22, 0.48, 0.72])
          box(0.09, y, 0.15, 0.91, y + 0.028, 0.2);
      } else {
        for (let i = 0; i < 7; i++) {
          const x = 0.15 + i * 0.11;
          box(x, 0, 0.09, x + 0.028, 0.045, 0.91);
          box(0.09, 0, x, 0.91, 0.045, x + 0.028);
        }
      }
    }
  }
  return faces;
}
