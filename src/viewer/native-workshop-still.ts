import type { SceneryObject } from "../shared/model.js";
import type { NativeWorkshopPixels } from "./native-workshop-relief.js";
import { NativeWorkshopGeometry } from "./native-workshop-geometry.js";

export function nativeWorkshopStill(
  o: SceneryObject,
  data: NativeWorkshopPixels,
) {
  if (o.workshop!.type !== "WORKSHOP_STILL" || !data.decor) return;
  const g = new NativeWorkshopGeometry(o, data),
    mask = new Uint8Array(data.width * data.height);
  const masonry = g.patch([3, 47, 28, 54], true),
    metal = g.patch([6, 30, 24, 43], true);
  g.box([0.09, 0, 0.2], [0.22, 0.22, 0.94], masonry);
  g.box([0.82, 0, 0.2], [0.95, 0.22, 0.94], masonry);
  g.box([0.09, 0, 0.2], [0.95, 0.22, 0.31], masonry);
  for (let x = 0.1; x < 0.94; x += 0.12)
    g.box([x, 0.2, 0.2], [x + 0.04, 0.24, 0.94], metal);
  g.cutout([6, 50, 28, 65], [0.52, 0.015, 0.9], 0.54, 0.17, 0.01);
  g.decal([5, 65, 31, 73], [0.12, 0.95, 0.94, 1.17], 0.012);
  const copper = g.skin([6, 26, 24, 43]);
  g.lathe(
    [0.52, 0.24, 0.52],
    0.32,
    0.55,
    copper,
    g.patch([12, 4, 21, 10]),
    "still",
  );
  g.lathe(
    [1.3, 0, 0.6],
    0.24,
    0.46,
    g.patch([34, 37, 43, 50]),
    g.patch([35, 24, 42, 29]),
    "jug",
  );
  const pipe = g.patch([22, 8, 32, 14]);
  g.beam([0.58, 0.76, 0.52], [1.18, 0.72, 0.55], 0.022, pipe);
  g.beam([1.18, 0.72, 0.55], [1.3, 0.63, 0.6], 0.022, pipe);
  g.beam([1.3, 0.63, 0.6], [1.3, 0.44, 0.6], 0.022, pipe);
  for (const [x, y, X, Y, cx, cy, cz] of [
    [62, 13, 84, 42, 2.23, 0.58, 0.17],
    [48, 30, 70, 58, 1.84, 0.25, 0.26],
    [71, 30, 94, 58, 2.58, 0.25, 0.26],
  ]) {
    const body = g.patch([x + 4, y + 3, X - 4, y + 13]),
      cap = g.skin([x + 1, y + (Y - y) * 0.48, X - 1, Y]);
    g.lathe([cx, cy, cz], 0.24, 0.47, body, cap, "barrel", true);
  }
  for (let y = 0; y < 76; y++)
    for (let x = 0; x < data.width; x++) mask[y * data.width + x] = 1;
  return { faces: g.faces, mask };
}
