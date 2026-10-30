import type { SceneryObject } from "../shared/model.js";
import type { NativeWorkshopPixels } from "./native-workshop-relief.js";
import {
  NativeWorkshopGeometry,
  type Rect,
} from "./native-workshop-geometry.js";

export function nativeWorkshopMachines(
  o: SceneryObject,
  data: NativeWorkshopPixels,
) {
  const type = o.workshop!.type;
  if (
    !/METALSMITH|MAGMAFORGE|MECHANIC|LOOM|BUTCHER|KITCHEN|SIEGE/.test(type) ||
    !data.decor
  )
    return;
  const g = new NativeWorkshopGeometry(o, data),
    mask = new Uint8Array(data.width * data.height);
  const consume = ([x, y, X, Y]: Rect) => {
    for (let b = y; b < Y; b++)
      for (let a = x; a < X; a++) mask[b * data.width + a] = 1;
  };
  if (type === "WORKSHOP_BUTCHER") {
    const wood = g.patch([28, 28, 53, 30], false, "wood");
    for (const x of [0.13, 1.94]) {
      g.box([x, 0, 0.2], [x + 0.055, 0.83, 0.255], wood);
      g.box([x - 0.06, 0, 0.1], [x + 0.11, 0.03, 0.45], wood);
    }
    g.box([0.13, 0.77, 0.2], [2, 0.83, 0.255], wood);
    g.box([0.75, 0.18, 0.2], [2, 0.23, 0.255], wood);
    g.cutout([8, 3, 60, 25], [1.06, 0.3, 0.265], 1.625, 0.47, 0.018);
    consume([0, 0, 66, 39]);
  } else if (type === "WORKSHOP_KITCHEN") {
    const stone = g.patch([37, 50, 51, 54], true),
      metal = g.patch([39, 36, 51, 44]);
    g.box([1.1, 0, 0.2], [1.25, 0.38, 0.86], stone);
    g.box([1.78, 0, 0.2], [1.94, 0.38, 0.86], stone);
    g.box([1.1, 0, 0.2], [1.94, 0.38, 0.3], stone);
    for (let x = 1.13; x < 1.95; x += 0.12)
      g.box([x, 0.37, 0.2], [x + 0.04, 0.405, 0.87], metal);
    for (let z = 0.24; z < 0.85; z += 0.14)
      g.box([1.1, 0.37, z], [1.94, 0.405, z + 0.035], metal);
    g.cutout([36, 49, 61, 68], [1.51, 0.01, 0.8], 0.6, 0.29, 0.01);
    g.decal([40, 34, 65, 51], [1.25, 0.35, 1.98, 0.83], 0.415);
    g.cutout([70, 20, 84, 28], [2.375, 0.7, 0.35], 0.4, 0.14, 0.03);
    consume([40, 34, 65, 51]);
    consume([70, 20, 84, 28]);
    consume([35, 28, 62, 34]);
    consume([36, 49, 61, 73]);
  } else if (type === "WORKSHOP_SIEGE") {
    const wood = g.skin([24, 39, 59, 42]),
      top = g.skin([89, 36, 103, 39]),
      side = g.skin([128, 40, 130, 52]),
      metal = g.skin([124, 24, 129, 27]);
    const beam = (
      a: [number, number, number],
      b: [number, number, number],
      r = 0.1,
    ) => {
      const start = g.faces.length;
      g.beam(a, b, r, wood, 4);
      for (const f of g.faces.splice(start)) {
        const p = Array.from(
          { length: 4 },
          (_, i) =>
            f.positions.slice(i * 3, i * 3 + 3) as [number, number, number],
        );
        const u = p[1].map((v, i) => v - p[0][i]),
          v = p[2].map((v, i) => v - p[0][i]);
        const n = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const upper = Math.abs(n[1]) > Math.hypot(...n) * 0.65;
        g.face(p, upper ? top : side, upper ? 1 : 0.9);
      }
    };
    const block = (a: [number, number, number], b: [number, number, number]) =>
      g.box(a, b, side, top, wood);
    // The rear-left machine is a thick stock between compact socket housings.
    block([0.67, 0.425, 0.36], [1.99, 0.615, 0.6]);
    block([0.29, 0.04, 0.345], [0.67, 0.64, 0.695]);
    block([1.94, 0.05, 0.3], [2.37, 0.69, 0.66]);
    g.lathe([2.15, 0.66, 0.48], 0.19, 0.07, side, top, "rock");
    for (const z of [0.32, 0.64])
      g.beam([0.68, 0.36, z], [2.02, 0.36, z], 0.018, metal, 4);
    for (const x of [0.69, 1.97])
      for (const z of [0.32, 0.64])
        g.beam([x, 0.36, z], [x, 0.49, z], 0.018, metal, 4);
    g.wheel([2.18, 0.18, 0.71], 0.115, g.skin([68, 46, 72, 49]), 0.07, 6);
    g.beam([2.18, 0.18, 0.45], [2.18, 0.18, 0.74], 0.035, wood);
    g.lathe([0.48, 0.61, 0.52], 0.12, 0.15, wood, side, "open");
    g.lathe([0.2, 0.02, 0.78], 0.18, 0.42, wood, side, "open");
    block([0.26, 0.16, 0.52], [0.48, 0.31, 0.8]);
    block([0.88, 0, 0.06], [1.16, 0.63, 0.34]);
    block([0.98, 0.43, 0.2], [1.1, 0.5, 0.48]);
    g.lathe([1.02, 0.61, 0.2], 0.17, 0.26, wood, side, "open");
    // Two independent rear-right post/stock assemblies, each with visible pivots.
    block([2.62, 0.495, 0.39], [3.95, 0.645, 0.57]);
    g.beam([2.63, 0.57, 0.39], [2.63, 0.57, 0.63], 0.085, wood, 10);
    block([3.4, 0.34, 0.405], [3.86, 0.72, 0.675]);
    g.beam([3.65, 0.55, 0.48], [3.65, 0.55, 0.76], 0.09, side, 10);
    block([3.885, 0, 0.565], [4.075, 0.85, 0.755]);
    g.box([3.88, 0.83, 0.56], [4.08, 0.88, 0.76], metal);
    beam([3.98, 0.76, 0.66], [4.78, 0.65, 0.96], 0.12);
    beam([3.56, 0.3, 0.67], [3.25, 0.24, 0.91], 0.08);
    block([4.195, 0, 1.245], [4.405, 0.82, 1.455]);
    g.box([4.19, 0.81, 1.24], [4.41, 0.86, 1.46], metal);
    block([4.13, 0, 1.19], [4.47, 0.055, 1.51]);
    beam([4.3, 0.64, 1.35], [4.87, 0.57, 1.63], 0.12);
    // Only the foreground engine has a triangular trestle.
    for (const z of [4.86]) {
      beam([3.16, 0.1, z], [3.63, 0.7, z - 0.42], 0.1);
      beam([4.13, 0.1, z], [3.63, 0.7, z - 0.42], 0.1);
    }
    block([3.73, 0.3, 4.26], [4.28, 0.42, 4.65]);
    for (const z of [4.1, 4.32]) block([3.78, 0.42, z], [3.9, 0.76, z + 0.06]);
    g.beam([3.87, 0.7, 4.21], [3.87, 0.7, 4.59], 0.085, side, 10);
    beam([3.65, 0.71, 4.49], [4.87, 0.79, 3.88], 0.12);
    block([3.78, 0.65, 4.36], [3.92, 0.79, 4.5]);
    // Loose cup-ended lever lies on the floor at the opposite front corner.
    g.lathe([0.23, 0.035, 4.48], 0.18, 0.12, wood, side, "bowl");
    beam([0.32, 0.08, 4.52], [1.35, 0.08, 4.88], 0.06);
    block([1.27, 0.02, 4.77], [1.51, 0.17, 4.98]);
    for (const region of [
      [0, 14, 80, 56],
      [82, 20, 160, 79],
      [0, 160, 53, 192],
      [99, 147, 160, 178],
      [99, 162, 137, 192],
    ] as Rect[])
      consume(region);
  } else if (/METALSMITH|MAGMAFORGE/.test(type)) {
    const anvilStart = g.faces.length;
    const metal = g.skin([44, 46, 56, 50]),
      top = g.skin([45, 39, 56, 42]);
    // Broad feet taper into a narrow waist below the overhanging anvil face.
    const rings = [
      [1.14, 1.91, 0.42, 0.8, 0.025],
      [1.24, 1.82, 0.46, 0.77, 0.12],
      [1.38, 1.68, 0.51, 0.73, 0.29],
      [1.19, 1.94, 0.37, 0.83, 0.43],
    ];
    for (let i = 0; i < rings.length - 1; i++) {
      const [x, X, z, Z, y] = rings[i],
        [a, A, b, B, Y] = rings[i + 1];
      g.face(
        [
          [x, y, Z],
          [a, Y, B],
          [A, Y, B],
          [X, y, Z],
        ],
        metal,
      );
      g.face(
        [
          [X, y, z],
          [A, Y, b],
          [a, Y, b],
          [x, y, z],
        ],
        metal,
        0.8,
      );
      g.face(
        [
          [x, y, z],
          [a, Y, b],
          [a, Y, B],
          [x, y, Z],
        ],
        metal,
        0.8,
      );
      g.face(
        [
          [X, y, Z],
          [A, Y, B],
          [A, Y, b],
          [X, y, z],
        ],
        metal,
        0.9,
      );
    }
    g.box([1.19, 0.43, 0.4], [1.94, 0.52, 0.8], metal, top);
    g.face(
      [
        [0.95, 0.47, 0.6],
        [1.2, 0.43, 0.37],
        [1.2, 0.52, 0.37],
        [0.95, 0.51, 0.6],
      ],
      metal,
    );
    g.face(
      [
        [0.95, 0.51, 0.6],
        [1.2, 0.52, 0.37],
        [1.2, 0.52, 0.83],
        [0.95, 0.51, 0.6],
      ],
      top,
    );
    g.face(
      [
        [0.95, 0.47, 0.6],
        [0.95, 0.51, 0.6],
        [1.2, 0.52, 0.83],
        [1.2, 0.43, 0.83],
      ],
      metal,
    );
    for (const f of g.faces.slice(anvilStart))
      for (let i = 0; i < f.positions.length; i += 3) {
        f.positions[i] = 1.5 + (f.positions[i] - 1.5) * 0.78;
        f.positions[i + 2] = 0.6 + (f.positions[i + 2] - 0.6) * 0.8;
      }
    for (const f of g.faces.splice(anvilStart)) {
      const pts = Array.from(
        { length: 4 },
        (_, i) =>
          f.positions.slice(i * 3, i * 3 + 3) as [number, number, number],
      );
      const extent = (axis: number) =>
        Math.max(...pts.map((p) => p[axis])) -
        Math.min(...pts.map((p) => p[axis]));
      if (extent(1) < 0.001) g.faces.push(f);
      else {
        const axis = extent(0) > extent(2) ? 0 : 2;
        g.tiled(
          pts,
          metal,
          pts.flatMap((p) => [p[axis] * 32, p[1] * 32]),
          f.brightness,
        );
      }
    }
    consume([31, 35, 65, 58]);
    const masonry = g.skin([78, 87, 90, 91], true),
      roof = g.skin([77, 77, 82, 81], true),
      dark = g.skin([78, 87, 90, 91], true);
    const stoneBox = (
      a: [number, number, number],
      b: [number, number, number],
    ) => {
      const start = g.faces.length;
      g.box(a, b, masonry, roof);
      for (const f of g.faces.splice(start)) {
        const pts = Array.from(
          { length: 4 },
          (_, i) =>
            f.positions.slice(i * 3, i * 3 + 3) as [number, number, number],
        );
        const flat = pts.every((p) => p[1] === pts[0][1]),
          side = pts.every((p) => p[0] === pts[0][0]);
        g.tiled(
          pts,
          flat ? roof : masonry,
          pts.flatMap((p) =>
            flat ? [p[0] * 32, p[2] * 32] : [p[side ? 2 : 0] * 32, p[1] * 32],
          ),
          f.brightness,
        );
      }
    };
    stoneBox([2.1, 0, 1.23], [2.92, 0.16, 2.13]);
    stoneBox([2.17, 0.16, 1.25], [2.32, 0.57, 2.03]);
    stoneBox([2.76, 0.16, 1.25], [2.91, 0.57, 2.03]);
    stoneBox([2.32, 0.16, 1.25], [2.76, 0.57, 1.37]);
    stoneBox([2.17, 0.5, 1.25], [2.91, 0.59, 2.03]);
    g.box([2.32, 0.16, 1.37], [2.76, 0.18, 2.04], dark);
    // The hearth mouth is an actual arch into the hot chamber.
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12;
      const p = (r: number, h: number, t: number): [number, number, number] => [
        2.54 + r * Math.cos(t),
        0.16 + h * Math.sin(t),
        2.04,
      ];
      const points: [number, number, number][] = [
        p(0.37, 0.43, a),
        p(0.22, 0.28, a),
        p(0.22, 0.28, b),
        p(0.37, 0.43, b),
      ];
      g.tiled(
        points,
        masonry,
        points.flatMap((p) => [p[0] * 32, p[1] * 32]),
      );
    }
    if (type.includes("MAGMA")) {
      const lava = g.patch([76, 74, 80, 80]);
      g.box([2.34, 0.18, 1.39], [2.74, 0.2, 2.02], lava);
      const path: [number, number, number][] = [
        [2.78, 0.18, 2.18],
        [2.25, 0.18, 2.18],
        [2.12, 0.17, 2.18],
        [2.02, 0.14, 2.18],
        [2.02, 0, 2.18],
      ];
      const tube = g.skin([80, 98, 88, 105], true);
      g.tube(path, 0.14, tube);
      for (const x of [2.4, 2.61])
        g.tube(
          [
            [x, 0.18, 2.18],
            [x + 0.035, 0.18, 2.18],
          ],
          0.151,
          roof,
          12,
        );
      for (let x = 2.34; x < 2.75; x += 0.1)
        g.box([x, 0.22, 1.4], [x + 0.035, 0.25, 2.03], metal);
      g.cutout([70, 70, 78, 85], [2.52, 0.27, 2.025], 0.34, 0.17, 0.012);
      g.box([2.55, 0.59, 1.45], [2.84, 0.6, 1.88], dark);
      g.decal([83, 65, 93, 78], [2.56, 1.46, 2.83, 1.87], 0.605);
    } else {
      g.cutout([70, 70, 78, 85], [2.52, 0.17, 2.025], 0.34, 0.26, 0.012);
      const chimney = g.skin([84, 70, 91, 74], true);
      g.lathe([2.65, 0.5, 1.46], 0.14, 0.32, chimney, dark, "pipe");
    }
    consume([69, 64, 96, 93]);
  } else if (type === "WORKSHOP_MECHANIC") {
    const wood = g.patch([22, 26, 45, 30], false, "wood"),
      metal = g.skin([47, 28, 53, 32]);
    const dark = g.skin([8, 43, 12, 47]);
    for (const [x, z, h] of [
      [1.98, 0.5, 0.65],
      [2.19, 0.23, 0.81],
      [2.48, 0.58, 0.69],
      [2.74, 0.29, 0.8],
      [2.68, 1.01, 0.55],
    ]) {
      g.beam([x, 0, z], [x, h, z], 0.07, wood, 8);
      for (const y of [0.08, h - 0.08])
        g.lathe([x, y, z], 0.085, 0.07, metal, metal, "stone");
    }
    g.beam([0.25, 0.55, 0.6], [2.8, 0.55, 0.6], 0.075, wood, 8);
    for (const x of [0.27, 0.68, 1.6, 2.03, 2.65])
      g.beam([x - 0.06, 0.55, 0.6], [x + 0.06, 0.55, 0.6], 0.09, metal, 8);
    g.box(
      [0.9, 0, 0.38],
      [1.43, 0.49, 0.88],
      wood,
      g.patch([29, 33, 43, 38]),
      g.skin([28, 35, 44, 49]),
    );
    for (const [x, y, z, r] of [
      [0.3, 0.39, 0.82, 0.25],
      [0.68, 0.24, 0.95, 0.18],
      [0.28, 0.65, 0.62, 0.15],
    ]) {
      g.wheel([x, y, z], r, dark, 0.1, 8);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5,
          c = x + Math.cos(a) * r,
          s = y + Math.sin(a) * r;
        g.box(
          [c - 0.035, s - 0.035, z - 0.06],
          [c + 0.035, s + 0.035, z + 0.06],
          metal,
        );
      }
    }
    consume([0, 14, 95, 68]);
  } else {
    const wood = g.skin([34, 25, 60, 28]),
      post = g.skin([25, 38, 27, 50]),
      metal = g.patch([27, 34, 29, 43]);
    for (const x of [0.8, 2.15])
      for (const z of [0.57, 1.38]) {
        g.box(
          [x, 0, z],
          [x + 0.065, 0.82, z + 0.065],
          post,
          g.skin([24, 18, 28, 22]),
          post,
        );
        g.box([x - 0.06, 0, z - 0.1], [x + 0.12, 0.035, z + 0.13], wood);
        for (const yy of [0.3, 0.64])
          g.box(
            [x - 0.008, yy, z - 0.008],
            [x + 0.073, yy + 0.04, z + 0.073],
            post,
          );
      }
    for (const y of [0.12, 0.73]) {
      g.beam([0.83, y, 0.61], [2.18, y, 0.61], 0.045, wood, 6);
      for (const x of [0.83, 2.18])
        g.beam([x, y, 0.61], [x, y, 1.4], 0.035, wood, 6);
    }
    g.beam([0.78, 0.69, 1.4], [2.22, 0.69, 1.4], 0.055, wood, 10);
    g.beam([0.78, 0.29, 1.48], [2.22, 0.29, 1.48], 0.06, wood, 10);
    g.face(
      [
        [0.95, 0.62, 1.35],
        [0.95, 0.31, 1.43],
        [2.04, 0.31, 1.43],
        [2.04, 0.62, 1.35],
      ],
      g.skin([33, 44, 64, 60]),
    );
    for (let x = 0.96; x < 2.05; x += 0.065)
      g.beam([x, 0.68, 1.34], [x, 0.34, 1.42], 0.008, metal, 4);
    g.beam([0.84, 0.51, 1.38], [2.17, 0.51, 1.38], 0.035, wood);
    g.beam([1.05, 0.72, 1.32], [1.64, 0.54, 1.32], 0.035, post, 4);
    g.face(
      [
        [0.85, 0.65, 1.4],
        [0.85, 0.57, 1.4],
        [2.17, 0.57, 1.4],
        [2.17, 0.65, 1.4],
      ],
      g.skin([28, 34, 68, 43]),
    );
    g.cutout([81, 18, 94, 44], [2.75, 0, 0.62], 0.35, 0.57, 0.045);
    consume([81, 18, 94, 44]);
    for (const x of [1.2, 1.6])
      g.box([x, 0.03, 0.75], [x + 0.09, 0.07, 1.65], wood);
    consume([22, 14, 76, 83]);
  }
  return { faces: g.faces, mask };
}
