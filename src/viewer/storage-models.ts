import type { SceneryObject, SpriteRef } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";
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
export function storageFaces(
  o: SceneryObject,
  ground: number,
): FurnitureFace[] | undefined {
  const type = o.furniture?.type;
  if (!type || !types.has(type) || !o.sprite) return;
  const faces: FurnitureFace[] = [],
    source = o.sprite;
  const crop = (x: number, y: number, w: number, h: number): SpriteRef => ({
    ...source,
    x: source.x + (x * source.width) / 32,
    y: source.y + (y * source.height) / 32,
    width: (w * source.width) / 32,
    height: (h * source.height) / 32,
  });
  const body =
    o.furniture?.color ?? ([140, 126, 104] as [number, number, number]);
  const core = type === "hive" ? crop(14, 10, 4, 4) : crop(13, 18, 5, 4);
  const add = (
    p: number[][],
    sprite: SpriteRef | undefined,
    tint?: [number, number, number],
    shade = 1,
  ) => {
    faces.push({
      positions: p.flatMap(([x, y, z]) => [o.x + x, ground + y, o.y + z]),
      sprite,
      palette: sprite ? o.palette : undefined,
      tint,
      brightness: shade,
    });
  };
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    texture: SpriteRef | null = null,
    color: [number, number, number] = body,
  ) => {
    const r = texture ?? undefined,
      t = texture ? undefined : color;
    add(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      r,
      t,
    );
    add(
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      r,
      t,
      0.5,
    );
    add(
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      r,
      t,
      0.85,
    );
    add(
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      r,
      t,
      0.68,
    );
    add(
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      r,
      t,
      0.74,
    );
    add(
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
      r,
      t,
      0.9,
    );
  };
  // Revolution profiles include outer walls, rims and inner walls; the opening
  // is real geometry. Shared angular UVs keep the native grain continuous.
  const lathe = (
    profile: number[][],
    texture: SpriteRef | null = core,
    color: [number, number, number] = body,
  ) => {
    const n = 16;
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2,
          b = ((i + 1) / n) * Math.PI * 2;
        const [r, y] = profile[j],
          [R, Y] = profile[j + 1];
        add(
          [
            [0.5 + Math.cos(a) * r, y, 0.5 + Math.sin(a) * r],
            [0.5 + Math.cos(b) * r, y, 0.5 + Math.sin(b) * r],
            [0.5 + Math.cos(b) * R, Y, 0.5 + Math.sin(b) * R],
            [0.5 + Math.cos(a) * R, Y, 0.5 + Math.sin(a) * R],
          ],
          texture ?? undefined,
          texture ? undefined : color,
          0.72 + 0.25 * Math.max(0, Math.cos(a - 0.7)),
        );
        if (texture) {
          const u = (i % 4) / 4,
            U = ((i % 4) + 1) / 4,
            mirror = Math.floor(i / 4) % 2;
          faces[faces.length - 1].uvs = [
            [u, y],
            [U, y],
            [U, Y],
            [u, Y],
          ].flatMap(([s, t]) => [
            (texture.x + (mirror ? 1 - s : s) * texture.width) /
              texture.pageWidth,
            1 -
              (texture.y + (1 - t / 0.85) * texture.height) /
                texture.pageHeight,
          ]);
        }
      }
  };
  if (type === "barrel") {
    lathe([
      [0, 0],
      [0.23, 0],
      [0.27, 0.08],
      [0.31, 0.3],
      [0.28, 0.58],
      [0.25, 0.66],
      [0.21, 0.66],
      [0.24, 0.58],
      [0.26, 0.3],
      [0.22, 0.07],
      [0, 0.07],
    ]);
    for (const y of [0.1, 0.51])
      lathe(
        [
          [0.285, y],
          [0.302, y + 0.025],
          [0.302, y + 0.065],
          [0.285, y + 0.07],
        ],
        null,
        [91, 88, 78],
      );
  } else if (type === "bin") {
    box(0.14, 0, 0.17, 0.86, 0.07, 0.83, core);
    box(0.14, 0.07, 0.17, 0.2, 0.44, 0.83, core);
    box(0.8, 0.07, 0.17, 0.86, 0.44, 0.83, core);
    box(0.2, 0.07, 0.17, 0.8, 0.44, 0.23, core);
    box(0.2, 0.07, 0.77, 0.8, 0.44, 0.83, core);
    box(0.12, 0.4, 0.15, 0.88, 0.46, 0.23, core);
    box(0.12, 0.4, 0.77, 0.88, 0.46, 0.85, core);
  } else if (type === "bucket") {
    lathe([
      [0, 0],
      [0.15, 0],
      [0.23, 0.38],
      [0.19, 0.38],
      [0.12, 0.06],
      [0, 0.06],
    ]);
    // Rectangular bail handle: no transparent billboard above the bucket.
    box(0.265, 0.32, 0.475, 0.29, 0.64, 0.525, null, [111, 105, 91]);
    box(0.71, 0.32, 0.475, 0.735, 0.64, 0.525, null, [111, 105, 91]);
    box(0.265, 0.615, 0.475, 0.735, 0.64, 0.525, null, [111, 105, 91]);
  } else if (type === "pot") {
    lathe([
      [0, 0],
      [0.18, 0],
      [0.28, 0.12],
      [0.31, 0.33],
      [0.25, 0.52],
      [0.2, 0.57],
      [0.2, 0.63],
      [0.16, 0.63],
      [0.16, 0.56],
      [0.21, 0.5],
      [0.26, 0.32],
      [0.23, 0.13],
      [0, 0.07],
    ]);
  } else if (type === "cage" || type === "animaltrap") {
    const small = type === "animaltrap",
      l = small ? 0.25 : 0.1,
      r = 1 - l,
      h = small ? 0.4 : 0.79,
      w = 0.025;
    box(l, 0, l, r, 0.06, r);
    for (const y of [0.06, h - 0.05]) {
      box(l, y, l, r, y + 0.04, l + 0.04);
      box(l, y, r - 0.04, r, y + 0.04, r);
      box(l, y, l, l + 0.04, y + 0.04, r);
      box(r - 0.04, y, l, r, y + 0.04, r);
    }
    for (let i = 0; i <= 5; i++) {
      const q = l + ((r - l - w) * i) / 5;
      box(q, 0.06, l, q + w, h, l + w);
      box(q, 0.06, r - w, q + w, h, r);
      box(l, 0.06, q, l + w, h, q + w);
      box(r - w, 0.06, q, r, h, q + w);
      box(q, h - 0.025, l, q + w, h, r);
    }
  } else if (type === "weaponrack") {
    box(0.12, 0, 0.25, 0.88, 0.07, 0.75);
    for (const x of [0.17, 0.77]) box(x, 0.07, 0.36, x + 0.06, 0.78, 0.52);
    for (const y of [0.22, 0.49, 0.72])
      box(0.17, y, 0.38, 0.83, y + 0.045, 0.49);
    for (let i = 0; i < 5; i++) {
      const x = 0.25 + i * 0.12;
      box(x, 0.5, 0.49, x + 0.025, 0.56, 0.6);
    }
  } else if (type === "armorstand") {
    box(0.25, 0, 0.25, 0.75, 0.08, 0.75);
    box(0.46, 0.08, 0.46, 0.54, 0.72, 0.54);
    box(0.29, 0.53, 0.46, 0.71, 0.59, 0.54);
    box(0.36, 0.31, 0.46, 0.64, 0.35, 0.54);
    box(0.42, 0.72, 0.42, 0.58, 0.83, 0.58);
  } else if (type === "nestbox") {
    box(0.17, 0, 0.17, 0.83, 0.07, 0.83);
    box(0.17, 0.07, 0.17, 0.23, 0.25, 0.83);
    box(0.77, 0.07, 0.17, 0.83, 0.25, 0.83);
    box(0.23, 0.07, 0.17, 0.77, 0.25, 0.23);
    box(0.23, 0.07, 0.77, 0.77, 0.25, 0.83);
    // Native straw artwork in the shallow interior, without invented eggs.
    box(0.24, 0.07, 0.24, 0.76, 0.105, 0.76, crop(10, 17, 12, 5));
  } else if (type === "hive") {
    lathe(
      [
        [0, 0],
        [0.28, 0],
        [0.3, 0.07],
        [0.29, 0.2],
        [0.26, 0.36],
        [0.2, 0.5],
        [0.12, 0.6],
        [0, 0.65],
      ],
      core,
    );
    for (const [r, y] of [
      [0.297, 0.08],
      [0.283, 0.21],
      [0.252, 0.35],
      [0.195, 0.49],
    ])
      lathe(
        [
          [r, y],
          [r + 0.012, y + 0.015],
          [r, y + 0.03],
        ],
        null,
        [143, 111, 58],
      );
    box(0.46, 0.06, 0.801, 0.54, 0.15, 0.806, null, [43, 31, 18]);
  }
  return faces;
}
