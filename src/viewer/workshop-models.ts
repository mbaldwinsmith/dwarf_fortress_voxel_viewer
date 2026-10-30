import type {
  SceneryObject,
  SpriteRef,
  FurnitureType,
} from "../shared/model.js";
import { furnitureFaces, type FurnitureFace } from "./furniture.js";
type Material = "wood" | "stone" | "metal" | [number, number, number];
const layouts = new Map<string, FurnitureFace[]>();
const nativeLayouts = new Map<string, FurnitureFace[]>();
export function hasNativeWorkshop(o: SceneryObject) {
  return nativeLayouts.has(workshopLayoutKey(o));
}
export function workshopLayoutKey(o: SceneryObject) {
  const w = o.workshop!;
  return JSON.stringify([w.type, w.width, w.depth, w.art, o.tint, o.palette]);
}
export function registerNativeWorkshop(
  o: SceneryObject,
  faces: FurnitureFace[],
) {
  nativeLayouts.set(workshopLayoutKey(o), faces);
  if (nativeLayouts.size > 96)
    nativeLayouts.delete(nativeLayouts.keys().next().value!);
}
const cells = new WeakMap<FurnitureFace[], Map<string, FurnitureFace[]>>();
const uv = (r?: SpriteRef) =>
  r
    ? [
        r.x / r.pageWidth,
        1 - r.y / r.pageHeight,
        r.x / r.pageWidth,
        1 - (r.y + r.height) / r.pageHeight,
        (r.x + r.width) / r.pageWidth,
        1 - (r.y + r.height) / r.pageHeight,
        (r.x + r.width) / r.pageWidth,
        1 - r.y / r.pageHeight,
      ]
    : [0, 1, 0, 0, 1, 0, 1, 1];
function layout(o: SceneryObject): FurnitureFace[] {
  const native = nativeLayouts.get(workshopLayoutKey(o));
  if (native) return native;
  const w = o.workshop!,
    key = JSON.stringify([
      w.type,
      w.width,
      w.depth,
      w.wood,
      w.stone,
      w.metal,
      o.tint,
      o.palette,
    ]);
  const old = layouts.get(key);
  if (old) return old;
  const faces: FurnitureFace[] = [];
  const texture = (m: Material) => {
    if (typeof m !== "string") return;
    const r = w[m];
    if (!r) return;
    return {
      ...r,
      x: r.x + (r.width * 5) / 32,
      y: r.y + (r.height * 4) / 32,
      width: (r.width * 22) / 32,
      height: (r.height * 15) / 32,
    };
  };
  const add = (points: number[][], m: Material = "wood", shade = 1) => {
    const sprite = texture(m);
    const tint = Array.isArray(m)
      ? m
      : !sprite
        ? ((m === "stone"
            ? (o.tint ?? [125, 126, 127])
            : m === "metal"
              ? [130, 139, 147]
              : [137, 110, 78]) as [number, number, number])
        : m === "wood"
          ? ([233, 189, 137] as [number, number, number])
          : undefined;
    faces.push({
      positions: points.flat(),
      sprite,
      palette: m === "stone" ? o.palette : undefined,
      tint,
      brightness: shade * (sprite && m === "wood" ? 1.4 : 1),
    });
  };
  const box = (
    x: number,
    y: number,
    z: number,
    X: number,
    Y: number,
    Z: number,
    m: Material = "wood",
  ) => {
    add(
      [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      m,
    );
    add(
      [
        [x, y, Z],
        [x, y, z],
        [X, y, z],
        [X, y, Z],
      ],
      m,
      0.48,
    );
    add(
      [
        [x, Y, Z],
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
      ],
      m,
      0.86,
    );
    add(
      [
        [X, Y, z],
        [X, y, z],
        [x, y, z],
        [x, Y, z],
      ],
      m,
      0.7,
    );
    add(
      [
        [x, Y, z],
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
      ],
      m,
      0.76,
    );
    add(
      [
        [X, Y, Z],
        [X, y, Z],
        [X, y, z],
        [X, Y, z],
      ],
      m,
      0.92,
    );
  };
  const round = (
    cx: number,
    y: number,
    cz: number,
    profile: number[][],
    m: Material = "stone",
    axis: "y" | "z" = "y",
  ) => {
    const p = (r: number, h: number, a: number) =>
      axis === "y"
        ? [cx + Math.cos(a) * r, y + h, cz + Math.sin(a) * r]
        : [cx + Math.cos(a) * r, y + Math.sin(a) * r, cz + h];
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          b = ((i + 1) / 12) * Math.PI * 2,
          [r, h] = profile[j],
          [R, H] = profile[j + 1];
        add(
          [p(r, h, a), p(r, h, b), p(R, H, b), p(R, H, a)],
          m,
          0.75 + 0.23 * Math.max(0, Math.cos(a - 0.7)),
        );
      }
  };
  const cylinder = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: Material = "stone",
  ) =>
    round(
      x,
      y,
      z,
      [
        [0, 0],
        [r, 0],
        [r, h],
        [0, h],
      ],
      m,
    );
  const part = (type: FurnitureType, x: number, z: number, s = 1, sy = 1) => {
    const ref = w.wood ?? o.sprite;
    if (!ref) return;
    const local = furnitureFaces(
      {
        id: "model",
        x: 0,
        y: 0,
        z: 0,
        name: type,
        kind: "ground",
        sprite: ref,
        furniture: { type, color: [132, 109, 77] },
      },
      0,
    );
    for (const f of local)
      faces.push({
        ...f,
        ...(f.sprite && !f.tint
          ? {
              tint: [233, 189, 137] as [number, number, number],
              brightness: f.brightness * 1.4,
            }
          : {}),
        positions: f.positions.map((v, i) =>
          i % 3 === 0 ? x + v * s : i % 3 === 1 ? v * sy : z + v * s,
        ),
      });
  };
  const barrel = (x: number, z: number, s = 0.7) =>
    part("barrel", x - s / 2, z - s / 2, s, 0.85);
  const stool = (x: number, z: number) => part("chair", x - 0.4, z - 0.4, 0.8);
  const bench = (
    x: number,
    z: number,
    width = 1,
    depth = 0.7,
    stone = false,
  ) => {
    const m = stone ? "stone" : "wood";
    if (stone)
      box(x + 0.05, 0, z + 0.05, x + width - 0.05, 0.44, z + depth - 0.05, m);
    else
      for (const X of [x + 0.04, x + width - 0.12])
        for (const Z of [z + 0.04, z + depth - 0.12])
          box(X, 0, Z, X + 0.08, 0.45, Z + 0.08);
    box(x, 0.45, z, x + width, 0.54, z + depth, m);
  };
  const pot = (x: number, z: number, r = 0.3, h = 0.5, m: Material = "stone") =>
    round(
      x,
      0,
      z,
      [
        [0, 0],
        [r * 0.65, 0],
        [r, 0.12],
        [r, h * 0.62],
        [r * 0.68, h],
        [r * 0.52, h],
        [r * 0.52, h - 0.05],
        [r * 0.8, h * 0.6],
        [0, 0.06],
      ],
      m,
    );
  const logs = (x: number, z: number) => {
    for (const [dx, y] of [
      [0, 0.12],
      [0.23, 0.12],
      [0.115, 0.32],
    ])
      round(
        x + dx,
        y,
        z,
        [
          [0, 0],
          [0.11, 0],
          [0.11, 0.75],
          [0, 0.75],
        ],
        "wood",
        "z",
      );
  };
  const crate = (x: number, z: number) => part("chest", x, z, 0.7, 0.7);
  const rack = (
    x: number,
    z: number,
    width = 1.8,
    cloth: Material = [178, 154, 117],
  ) => {
    for (const X of [x, x + width]) box(X, 0, z, X + 0.07, 0.78, z + 0.1);
    box(x, 0.72, z, x + width + 0.07, 0.8, z + 0.1);
    box(x + 0.18, 0.25, z + 0.035, x + width - 0.1, 0.71, z + 0.065, cloth);
  };
  const wheel = (
    x: number,
    y: number,
    z: number,
    r = 0.36,
    material: Material = "wood",
  ) => {
    round(
      x,
      y,
      z,
      [
        [r * 0.78, 0],
        [r, 0],
        [r, 0.06],
        [r * 0.78, 0.06],
        [r * 0.78, 0],
      ],
      material,
      "z",
    );
    for (let i = 0; i < 6; i++) {
      const start = faces.length;
      box(
        x - r * 0.85,
        y - 0.018,
        z + 0.015,
        x + r * 0.85,
        y + 0.018,
        z + 0.045,
        material,
      );
      const a = (i / 6) * Math.PI;
      for (const f of faces.slice(start))
        for (let k = 0; k < f.positions.length; k += 3) {
          const X = f.positions[k] - x,
            Y = f.positions[k + 1] - y;
          f.positions[k] = x + X * Math.cos(a) - Y * Math.sin(a);
          f.positions[k + 1] = y + X * Math.sin(a) + Y * Math.cos(a);
        }
    }
    box(x - 0.08, 0, z - 0.06, x + 0.08, y, z + 0.12, material);
    if (material === "metal")
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          X = x + Math.cos(a) * (r + 0.02),
          Y = y + Math.sin(a) * (r + 0.02);
        box(
          X - 0.035,
          Y - 0.035,
          z - 0.005,
          X + 0.035,
          Y + 0.035,
          z + 0.065,
          material,
        );
      }
  };
  const anvil = (x: number, z: number) => {
    box(x - 0.26, 0, z - 0.22, x + 0.26, 0.16, z + 0.22, "stone");
    box(x - 0.12, 0.16, z - 0.12, x + 0.12, 0.4, z + 0.12, "metal");
    box(x - 0.32, 0.4, z - 0.17, x + 0.28, 0.52, z + 0.17, "metal");
    box(x + 0.28, 0.41, z - 0.1, x + 0.47, 0.49, z + 0.1, "metal");
    box(x + 0.47, 0.425, z - 0.05, x + 0.59, 0.465, z + 0.05, "metal");
  };
  const hearth = (x: number, z: number, vault = false, lava = false) => {
    box(x - 0.65, 0, z - 0.55, x + 0.65, 0.1, z + 0.55, "stone");
    box(x - 0.65, 0.1, z - 0.5, x - 0.35, 0.48, z + 0.5, "stone");
    box(x + 0.35, 0.1, z - 0.5, x + 0.65, 0.48, z + 0.5, "stone");
    box(x - 0.35, 0.1, z - 0.5, x + 0.35, 0.48, z - 0.3, "stone");
    if (vault) box(x - 0.65, 0.46, z - 0.5, x + 0.65, 0.77, z + 0.5, "stone");
    else
      round(
        x,
        0.45,
        z,
        [
          [0.65, 0],
          [0.64, 0.1],
          [0.49, 0.25],
          [0.22, 0.36],
          [0, 0.36],
        ],
        "stone",
      );
    box(
      x - 0.3,
      0.1,
      z - 0.28,
      x + 0.3,
      0.12,
      z + 0.3,
      lava ? [178, 69, 25] : [38, 34, 31],
    );
  };
  const small =
    w.type === "WORKSHOP_QUERN" ||
    w.type === "WORKSHOP_MILLSTONE" ||
    w.type === "WORKSHOP_CUSTOM:SCREW_PRESS";
  const big =
    w.type === "WORKSHOP_KENNEL" ||
    w.type === "WORKSHOP_SIEGE" ||
    w.type === "TRADE_DEPOT";
  const type = w.type.replace(/^WORKSHOP_/, "");
  if (w.type.startsWith("FURNACE_")) {
    hearth(1.5, 0.8, w.type.includes("KILN"), w.type.includes("LAVA"));
    if (!w.type.includes("KILN"))
      cylinder(1.5, 0.75, 0.55, 0.13, 0.09, "stone");
    if (w.type === "FURNACE_WOOD") logs(0.22, 1.75);
    else {
      pot(0.4, 2.45, 0.25, 0.35);
      pot(0.9, 2.45, 0.21, 0.3);
    }
    if (w.type.includes("GLASS")) {
      for (let i = 0; i < 3; i++)
        pot(2 + i * 0.26, 2.3, 0.11, 0.28, [66, 119, 105]);
    } else if (w.type.includes("KILN")) {
      pot(2.3, 2.3, 0.3, 0.4);
      pot(2.7, 1.6, 0.18, 0.3);
    } else {
      bench(1.8, 2.1, 0.9, 0.6, true);
      box(0.3, 0, 1.5, 0.65, 0.2, 1.85, [52, 49, 46]);
    }
    if (w.type.includes("LAVA"))
      for (const x of [0.22, 2.6])
        box(x, 0, 0.13, x + 0.12, 0.55, 0.55, "metal");
  } else
    switch (type) {
      case "CARPENTER":
        bench(0.08, 0.8, 0.75, 2);
        bench(2.05, 0.1, 0.85, 0.8);
        logs(0.2, 0.05);
        crate(2.1, 2.1);
        break;
      case "MASON":
        bench(0.08, 0.7, 0.75, 2.1, true);
        box(2.1, 0, 0.25, 2.75, 0.55, 0.95, "stone");
        for (let i = 0; i < 3; i++)
          cylinder(1.5 + i * 0.35, 0, 2.4, 0.18, 0.18, "stone");
        break;
      case "CRAFTS":
        bench(0.08, 0.15, 1.1, 0.8);
        bench(1.8, 1.9, 1, 0.75);
        stool(1.4, 2.4);
        crate(0.1, 2.1);
        break;
      case "JEWELER":
        bench(0.1, 2, 2.8, 0.75, true);
        bench(0.1, 0.1, 0.9, 0.7);
        for (let i = 0; i < 4; i++)
          box(
            0.4 + i * 0.34,
            0.54,
            2.2,
            0.54 + i * 0.34,
            0.63,
            2.34,
            i % 2 ? [92, 155, 119] : [156, 88, 146],
          );
        stool(2.4, 1.5);
        break;
      case "METALSMITH":
      case "MAGMAFORGE":
        hearth(1.5, 0.65, false, type === "MAGMAFORGE");
        anvil(1.45, 1.8);
        barrel(0.4, 2.5);
        for (let i = 0; i < 3; i++)
          box(2.1, 0.06 * i, 2.2, 2.8, 0.06 * i + 0.05, 2.4, "metal");
        break;
      case "BOWYER":
        bench(0.1, 0.1, 1.2, 0.8);
        bench(0.1, 1.9, 1, 0.8);
        logs(2.3, 0.1);
        box(1.5, 0.1, 1.4, 2.7, 0.17, 1.52);
        stool(2.3, 2.4);
        break;
      case "MECHANIC":
        wheel(0.65, 0.43, 0.2, 0.33, "metal");
        wheel(1.5, 0.4, 0.2, 0.26, "metal");
        bench(0.1, 1.9, 1.1, 0.8, true);
        stool(2, 1.65);
        box(2.35, 0, 0.1, 2.5, 0.72, 0.28, "metal");
        break;
      case "BUTCHER":
        rack(0.15, 0.1, 2.35, [155, 76, 70]);
        bench(0.1, 1.2, 1.5, 0.7, true);
        barrel(2.5, 1.3);
        crate(2, 2.3);
        break;
      case "LEATHER":
        rack(1, 0.12, 1.7, [135, 92, 58]);
        bench(0.1, 1.2, 0.9, 1.5);
        pot(0.5, 0.5);
        barrel(2.5, 2.5);
        break;
      case "TANNER":
        rack(0.15, 0.1, 2.5, [152, 118, 78]);
        pot(0.55, 1.65, 0.42, 0.36);
        pot(1.5, 1.65, 0.42, 0.36);
        bench(2.15, 2.1, 0.75, 0.7);
        break;
      case "CLOTHES":
        rack(0.15, 0.1, 2.2, [92, 132, 150]);
        bench(0.1, 1.2, 1.2, 0.8);
        stool(1.5, 2.5);
        crate(2.15, 2.1);
        cylinder(2.5, 0.02, 1.5, 0.2, 0.3, [169, 127, 83]);
        break;
      case "FISHERY":
        bench(0.1, 0.15, 2.2, 0.7, true);
        barrel(0.4, 2.5);
        barrel(2.5, 2.5);
        pot(1.5, 1.7, 0.38, 0.3);
        break;
      case "STILL":
        pot(0.7, 0.65, 0.4, 0.73, [183, 115, 54]);
        box(0.9, 0.58, 0.6, 1.6, 0.65, 0.7, [183, 115, 54]);
        pot(1.7, 0.7, 0.24, 0.45);
        barrel(2.5, 0.6);
        barrel(0.5, 2.5);
        barrel(1.4, 2.5);
        barrel(2.3, 2.5);
        break;
      case "LOOM":
        for (const x of [0.6, 2.3])
          for (const z of [0.2, 1.5]) box(x, 0, z, x + 0.09, 0.81, z + 0.09);
        for (const y of [0.19, 0.7]) box(0.6, y, 0.2, 2.39, y + 0.08, 0.3);
        box(0.6, 0.27, 1.5, 2.39, 0.36, 1.65);
        add(
          [
            [0.7, 0.68, 0.3],
            [0.7, 0.34, 1.5],
            [2.3, 0.34, 1.5],
            [2.3, 0.68, 0.3],
          ],
          [188, 172, 140],
        );
        for (let i = 0; i < 14; i++)
          add(
            [
              [0.73 + i * 0.115, 0.684, 0.3],
              [0.73 + i * 0.115, 0.344, 1.5],
              [0.745 + i * 0.115, 0.344, 1.5],
              [0.745 + i * 0.115, 0.684, 0.3],
            ],
            [222, 211, 177],
          );
        stool(1.5, 2.5);
        break;
      case "KITCHEN":
        pot(0.5, 0.55, 0.38, 0.6, [57, 57, 57]);
        pot(2.45, 0.55, 0.36, 0.48, [57, 57, 57]);
        bench(0.1, 2, 2.8, 0.75);
        barrel(0.5, 1.4);
        break;
      case "ASHERY":
        barrel(0.5, 0.6, 0.9);
        barrel(1.5, 0.6, 0.9);
        pot(2.4, 1.4, 0.43, 0.32);
        bench(0.1, 2.2, 1.1, 0.65);
        break;
      case "DYER":
        for (let i = 0; i < 3; i++) {
          pot(0.5 + i, 1, 0.38, 0.48);
          cylinder(
            0.5 + i,
            0.39,
            1,
            0.24,
            0.015,
            i % 2 ? [89, 130, 87] : [89, 106, 156],
          );
        }
        bench(0.1, 2.2, 1, 0.6);
        stool(2.4, 2.5);
        break;
      case "FARMER":
        barrel(0.5, 0.5);
        barrel(1.3, 0.5);
        wheel(2.25, 0.43, 2.25, 0.36);
        bench(0.1, 2.1, 0.85, 0.7);
        pot(2.5, 0.6, 0.25, 0.4);
        break;
      case "CUSTOM:SOAP_MAKER":
        pot(0.6, 0.6, 0.36, 0.55);
        barrel(1.55, 0.5);
        bench(0.1, 2, 1.6, 0.7);
        for (let i = 0; i < 3; i++)
          box(
            0.25 + i * 0.4,
            0.54,
            2.18,
            0.53 + i * 0.4,
            0.64,
            2.48,
            [211, 188, 112],
          );
        pot(2.5, 2.5, 0.25, 0.4);
        break;
      case "QUERN":
      case "MILLSTONE":
        round(
          0.5,
          0,
          0.5,
          [
            [0, 0],
            [0.33, 0],
            [0.35, 0.18],
            [0.32, 0.34],
            [0.07, 0.34],
            [0.07, 0.12],
            [0, 0.12],
          ],
          "stone",
        );
        if (type === "QUERN") box(0.32, 0.34, 0.44, 0.82, 0.4, 0.51);
        else box(0.45, 0.2, 0.45, 0.55, 0.68, 0.55, "metal");
        break;
      case "CUSTOM:SCREW_PRESS":
        barrel(0.5, 0.5, 0.85);
        for (const x of [0.12, 0.81]) box(x, 0, 0.35, x + 0.07, 0.79, 0.65);
        box(0.12, 0.75, 0.35, 0.88, 0.83, 0.65);
        cylinder(0.5, 0.43, 0.5, 0.05, 0.34, "metal");
        for (let i = 0; i < 6; i++)
          cylinder(0.5, 0.45 + i * 0.045, 0.5, 0.075, 0.015, "metal");
        box(0.24, 0.72, 0.46, 0.76, 0.75, 0.54);
        break;
      case "KENNEL":
        for (const x of [0.1, 4.8])
          for (let i = 0; i < 6; i++)
            box(x, 0, 0.12 + i * 0.78, x + 0.06, 0.58, 0.18 + i * 0.78);
        for (const x of [0.1, 4.8])
          for (const y of [0.22, 0.48])
            box(x, y, 0.12, x + 0.06, y + 0.035, 4.86);
        part("cage", 1.25, 1.25, 1.4);
        barrel(0.6, 3.5);
        stool(2.5, 4.3);
        break;
      case "SIEGE":
        bench(0.1, 1.3, 1.7, 0.75, true);
        bench(0.1, 3, 1.7, 0.75, true);
        logs(0.2, 0.1);
        box(2, 0.12, 0.45, 4.55, 0.28, 0.65);
        box(3.1, 0.28, 0.15, 3.35, 0.7, 0.95);
        box(2.45, 0.15, 2, 2.65, 0.65, 3.8);
        box(2, 0.6, 2.25, 3.65, 0.7, 2.45);
        crate(3.9, 4);
        break;
      case "TRADE_DEPOT":
        bench(0.12, 0.2, 0.8, 4.2);
        bench(3.9, 0.2, 0.8, 4.2);
        bench(1.65, 3.7, 1.1, 1);
        barrel(1.3, 0.5);
        barrel(2, 0.5);
        crate(2.6, 0.2);
        stool(2.5, 2.5);
        stool(3.2, 4.3);
        break;
    }
  const scaleX = w.width / (small ? 1 : big ? 5 : 3),
    scaleZ = w.depth / (small ? 1 : big ? 5 : 3);
  for (const f of faces)
    f.positions = f.positions.map((v, i) =>
      i % 3 === 0 ? v * scaleX : i % 3 === 2 ? v * scaleZ : v,
    );
  layouts.set(key, faces);
  if (layouts.size > 96) layouts.delete(layouts.keys().next().value!);
  return faces;
}
type Vertex = { p: number[]; uv: number[] };
function clip(
  vertices: Vertex[],
  axis: number,
  bound: number,
  greater: boolean,
) {
  const out: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      inside = (v: Vertex) =>
        greater ? v.p[axis] >= bound : v.p[axis] <= bound;
    const A = inside(a),
      B = inside(b);
    if (A) out.push(a);
    if (A !== B) {
      const t = (bound - a.p[axis]) / (b.p[axis] - a.p[axis]);
      out.push({
        p: a.p.map((v, k) => v + (b.p[k] - v) * t),
        uv: a.uv.map((v, k) => v + (b.uv[k] - v) * t),
      });
    }
  }
  return out;
}
export function workshopFaces(
  o: SceneryObject,
  ground: number,
): FurnitureFace[] {
  const w = o.workshop;
  if (!w) return [];
  const result: FurnitureFace[] = [];
  const native = nativeLayouts.has(workshopLayoutKey(o));
  const floor = native ? (w.floor ?? o.sprite) : o.sprite;
  if (floor && w.width > 1)
    result.push({
      positions: [
        o.x,
        ground + 0.005,
        o.y,
        o.x,
        ground + 0.005,
        o.y + 1,
        o.x + 1,
        ground + 0.005,
        o.y + 1,
        o.x + 1,
        ground + 0.005,
        o.y,
      ],
      sprite: floor,
      tint: o.tint,
      brightness: o.tint ? 1.4 : 1,
    });
  const base = layout(o),
    cellKey = `${w.col},${w.row}`;
  let parts = cells.get(base);
  if (!parts) {
    parts = new Map();
    cells.set(base, parts);
  }
  let local = parts.get(cellKey);
  if (!local) {
    local = [];
    for (const f of base) {
      const coords = f.uvs ?? uv(f.sprite);
      let v: Vertex[] = Array.from({ length: 4 }, (_, i) => ({
        p: f.positions.slice(i * 3, i * 3 + 3),
        uv: coords.slice(i * 2, i * 2 + 2),
      }));
      v = clip(v, 0, w.col, true);
      v = clip(v, 0, w.col + 1, false);
      v = clip(v, 2, w.row, true);
      v = clip(v, 2, w.row + 1, false);
      if (v.length < 3) continue;
      const emit = (points: Vertex[]) =>
        local!.push({
          ...f,
          positions: points.flatMap((v) => [
            v.p[0] - w.col,
            v.p[1],
            v.p[2] - w.row,
          ]),
          uvs: points.flatMap((v) => v.uv),
        });
      if (v.length === 4) emit(v);
      else
        for (let i = 1; i < v.length - 1; i++)
          emit([v[0], v[i], v[i + 1], v[i + 1]]);
    }
    parts.set(cellKey, local);
  }
  for (const f of local)
    result.push({
      ...f,
      positions: f.positions.map(
        (v, i) => v + (i % 3 === 0 ? o.x : i % 3 === 1 ? ground : o.y),
      ),
    });
  return result;
}
