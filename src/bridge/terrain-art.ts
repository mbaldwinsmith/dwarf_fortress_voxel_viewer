import type { Chunk } from "../shared/model.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
export function textureTerrain(
  chunk: Chunk,
  graphics: Pick<SceneryGraphics, "get">,
  materials?: unknown,
) {
  const mats = Array.isArray(materials) ? materials : [];
  for (let i = 0; i < 256; i++) {
    const t = chunk.tiles[i];
    if (!t || t.shape === "unknown" || t.shape === "empty" || t.treeGraphic)
      continue;
    const x = chunk.x + (i % 16),
      y = chunk.y + Math.floor(i / 16);
    const variant =
      (((Math.imul(x, 73856093) ^
        Math.imul(y, 19349663) ^
        Math.imul(chunk.z, 83492791)) >>>
        0) %
        4) +
      1;
    const wood =
      t.material === 7 &&
      Number(mats[i]?.matType) >= 419 &&
      Number(mats[i]?.matType) < 619;
    let floor = t.smooth || t.material === 7 ? "SMOOTH_FLOOR" : "STONE_FLOOR_5";
    let wall =
      t.smooth || t.material === 7
        ? "SMOOTHED_STONE_WALL_N_S_W_E"
        : `STONE_WALL_N_S_W_E_${variant}`;
    if (t.material === 1) {
      floor = "DIRT_FLOOR_5";
      wall = "DIRT_FLOOR_5";
    }
    if ([8, 9, 10, 11, 12].includes(t.material)) {
      floor = "GRASS_5";
      wall = "DIRT_FLOOR_5";
    }
    if (t.material === 6) {
      floor = t.smooth ? "SMOOTH_ICE_FLOOR" : "ROUGH_ICE_FLOOR";
      wall = "ICE_WALL_N_S_W_E";
    }
    if (wood) {
      floor = "WOOD_FLOOR";
      wall = "WOOD_FLOOR";
    }
    const top =
      graphics.get(t.shape === "wall" ? wall : floor) ?? graphics.get(floor);
    const side = graphics.get(t.shape === "wall" ? wall : floor) ?? top;
    if (top && side) t.surfaces = { top, side };
  }
}
