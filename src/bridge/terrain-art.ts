import type { Chunk } from "../shared/model.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
import { wallTileSuffixes } from "./wall-tiles.js";
export interface TerrainMaterial {
  id: string;
  name: string;
  color?: [number, number, number];
}
export function terrainMaterials(value: unknown) {
  const result = new Map<string, TerrainMaterial>();
  for (const d of Array.isArray(value) ? value : []) {
    const p = d?.matPair,
      c = d?.stateColor;
    if (
      !p ||
      !Number.isInteger(p.matType) ||
      !Number.isInteger(p.matIndex) ||
      typeof d.id !== "string"
    )
      continue;
    const rgb = c ? [c.red, c.green, c.blue] : undefined;
    const color = rgb?.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
      ? (rgb as [number, number, number])
      : undefined;
    result.set(`${p.matType},${p.matIndex}`, {
      id: d.id,
      name: String(d.name ?? d.id).slice(0, 120),
      ...(color ? { color } : {}),
    });
  }
  return result;
}
interface TerrainContext {
  gems?: Set<string>;
  ores?: Set<string>;
  definitions?: Map<string, TerrainMaterial>;
  plants?: Map<number, { id: string; name: string }>;
  layerMaterials?: unknown;
  baseMaterials?: unknown;
}
export function textureTerrain(
  chunk: Chunk,
  graphics: Pick<SceneryGraphics, "get">,
  materials?: unknown,
  context: TerrainContext = {},
) {
  const mats = Array.isArray(materials) ? materials : [];
  const layers = Array.isArray(context.layerMaterials)
    ? context.layerMaterials
    : [];
  const bases = Array.isArray(context.baseMaterials)
    ? context.baseMaterials
    : [];
  const definition = (p: any) =>
    p ? context.definitions?.get(`${p.matType},${p.matIndex}`) : undefined;
  for (let i = 0; i < 256; i++) {
    const t = chunk.tiles[i];
    if (t) {
      delete t.surfaces;
      delete t.color;
      delete t.materialName;
      delete t.wallCap;
      delete t.wallRim;
      delete t.wallRimTint;
    }
    const x = chunk.x + (i % 16),
      y = chunk.y + Math.floor(i / 16);
    const hash =
      (Math.imul(x, 73856093) ^
        Math.imul(y, 19349663) ^
        Math.imul(chunk.z, 83492791)) >>>
      0;
    if (
      !t ||
      t.sealed ||
      t.shape === "unknown" ||
      t.shape === "empty" ||
      t.treeGraphic
    )
      continue;
    const grass = [8, 9, 10, 11].includes(t.material);
    const actual = definition(mats[i]) ?? definition(bases[i]);
    const ground =
      grass || t.material === 12 ? (definition(layers[i]) ?? actual) : actual;
    if (ground?.color) t.color = ground.color;
    if (actual) t.materialName = actual.name;
    const variant = (t.variant ?? hash % 4) + 1;
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
    if (grass) {
      floor = "GRASS_5";
      wall = "DIRT_FLOOR_5";
    }
    if (t.material === 6) {
      floor = t.smooth ? "SMOOTH_ICE_FLOOR" : "ROUGH_ICE_FLOOR";
      wall = "ICE_WALL_N_S_W_E";
    }
    if (wood) {
      floor = "WOOD_FLOOR";
      wall = "WOODEN_WALL_N_S_W_E";
    }
    if (t.shape === "wall" && t.wallMask) {
      const prefix = wood
        ? "WOODEN_WALL"
        : t.material === 1
          ? "SOIL_WALL"
          : t.material === 6
            ? "ICE_WALL"
            : t.material === 5
              ? context.gems?.has(actual?.id ?? "")
                ? "GEM_A_WALL"
                : context.ores?.has(actual?.id ?? "")
                  ? "ORE_VEIN_WALL"
                  : "STONE_WALL"
              : t.smooth || t.material === 7
                ? "SMOOTHED_STONE_WALL"
                : "STONE_WALL";
      const rim = wallTileSuffixes(t.wallMask).flatMap((suffix) => {
        const r =
          graphics.get(`${prefix}_${suffix}_${variant}`) ??
          graphics.get(`${prefix}_${suffix}`);
        return r ? [r] : [];
      });
      if (rim.length) {
        t.wallRim = rim;
        if (t.material === 5) {
          const rgb = actual?.color ?? [255, 255, 255];
          if (context.gems?.has(actual?.id ?? "")) t.wallRimTint = rgb;
          else if (context.ores?.has(actual?.id ?? ""))
            t.wallRimTint = rgb.map((c) => Math.round(204 + c * 0.2)) as [
              number,
              number,
              number,
            ];
        }
      }
    }
    const species =
      grass && Number(mats[i]?.matType) >= 419 && Number(mats[i]?.matType) < 619
        ? context.plants?.get(Number(mats[i]?.matIndex))
        : undefined;
    const grassArt = species
      ? graphics.get(`PLANT:${species.id}:GRASS_${variant}`)
      : undefined;
    const top =
      grassArt ??
      graphics.get(t.shape === "wall" ? wall : floor) ??
      graphics.get(floor);
    const side =
      graphics.get(
        grass ? "DIRT_FLOOR_5" : t.shape === "wall" ? wall : floor,
      ) ?? top;
    if (top && side)
      t.surfaces = {
        top,
        side,
        ...(grassArt || t.shape !== "wall"
          ? { topTint: [255, 255, 255] as [number, number, number] }
          : {}),
      };
  }
}
