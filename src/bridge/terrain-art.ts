import type { Chunk, SpriteLayer } from "../shared/model.js";
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
  metals?: Set<string>;
  palettes?: Map<string, NonNullable<SpriteLayer["palette"]>>;
  colorPalettes?: Map<string, NonNullable<SpriteLayer["palette"]>>;
  constructionItems?: unknown;
  itemDefinitions?: Map<string, string>;
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
    if (t?.liquid && t.shape !== "unknown") {
      t.liquid.surface = graphics.get(
        `${t.liquid.kind === "water" ? "UNDERWATER" : "UNDERMAGMA"}_${t.liquid.depth}`,
      );
    }
    if (t) {
      delete t.surfaces;
      delete t.color;
      delete t.materialName;
      delete t.wallCap;
      delete t.wallRim;
      delete t.wallRimTint;
      delete t.wallRimPalette;
      delete t.wallRimTone;
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
    const construction = t.material === 7;
    const wood =
      construction &&
      ((actual?.id.startsWith("PLANT:") && actual.id.endsWith(":WOOD")) ||
        (!actual &&
          Number(mats[i]?.matType) >= 419 &&
          Number(mats[i]?.matType) < 619));
    const ice = t.material === 6 || (construction && actual?.id === "WATER");
    const metal = construction && context.metals?.has(actual?.id ?? "");
    const glass =
      construction &&
      /^GLASS_(GREEN|CLEAR|CRYSTAL)$/.exec(actual?.id ?? "")?.[1];
    const items = Array.isArray(context.constructionItems)
      ? context.constructionItems
      : [];
    const item = items[i],
      itemId =
        item &&
        (context.itemDefinitions?.get(`${item.matType},${item.matIndex}`) ??
          context.itemDefinitions?.get(`${item.matType},-1`));
    const blocks = construction && itemId === "BLOCKS";
    const materialPalette =
      context.palettes?.get(actual?.id ?? "") ??
      (ground?.color && context.colorPalettes?.get(ground.color.join(",")));
    // Authored glass/ice colours are retained. Stone, metal and wood use the
    // installed descriptor palette, not a second RGB multiply over the art.
    const surfacePalette =
      !glass && !ice && !grass && t.material !== 1
        ? materialPalette
        : undefined;
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
    if (ice) {
      floor = t.smooth || construction ? "SMOOTH_ICE_FLOOR" : "ROUGH_ICE_FLOOR";
      wall = "ICE_WALL_N_S_W_E";
    }
    if (wood) {
      floor = "WOOD_FLOOR";
      wall = "WOODEN_WALL_N_S_W_E";
    }
    if (blocks && !wood && !metal && !glass && !ice)
      floor = "FLOOR_STONE_BLOCK";
    if (metal) floor = "METAL_FLOOR";
    if (glass) floor = `GLASS_${glass}_FLOOR`;
    // Vertical walls need an opaque material skin. Native wall sheets are
    // transparent, top-down exposed-edge diagrams; those remain on the cap.
    const finished = !!t.smooth || construction;
    if (finished || ice) wall = floor;
    const engraved =
      !!t.engraving && finished && (t.shape === "wall" || t.shape === "floor");
    const engraving = engraved
      ? graphics.get("FLOOR_STONE_ENGRAVED_PALETTE")
      : undefined;
    const tone = wood || glass || ice ? graphics.get(floor) : undefined;
    const carvingPalette = glass || ice ? undefined : materialPalette;
    if (glass && t.shape === "wall") t.wallCap = graphics.get(floor);
    if (t.shape === "wall" && t.wallMask) {
      const prefix = wood
        ? "WOODEN_WALL"
        : metal
          ? "METAL_BARS_WALL"
          : blocks && !ice
            ? "ROCK_BLOCKS_WALL"
            : t.material === 1
              ? "SOIL_WALL"
              : ice
                ? t.smooth || construction
                  ? "SMOOTHED_ICE_WALL"
                  : "ICE_WALL"
                : t.smooth || construction
                  ? "SMOOTHED_STONE_WALL"
                  : t.material === 5
                    ? context.gems?.has(actual?.id ?? "")
                      ? "GEM_A_WALL"
                      : context.ores?.has(actual?.id ?? "")
                        ? "ORE_VEIN_WALL"
                        : "STONE_WALL"
                    : "STONE_WALL";
      const rim = (glass ? [] : wallTileSuffixes(t.wallMask)).flatMap(
        (suffix) => {
          const r =
            graphics.get(`${prefix}_${suffix}_${variant}`) ??
            graphics.get(`${prefix}_${suffix}`);
          const host =
            !finished && t.material === 5 && context.gems?.has(actual?.id ?? "")
              ? graphics.get(`STONE_WALL_${suffix}_${variant}`)
              : undefined;
          return [...(host ? [host] : []), ...(r ? [r] : [])];
        },
      );
      if (rim.length) {
        t.wallRim = rim;
        if (carvingPalette && (surfacePalette || finished)) {
          t.wallRimPalette = carvingPalette;
          t.wallRimTint = [255, 255, 255];
        } else if (wood || glass || ice) t.wallRimTint = [255, 255, 255];
        else if (t.material === 5 && !t.smooth) {
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
      if (engraved) {
        // Only carved, exposed directions receive native engraving edge art.
        const engravedRims = wallTileSuffixes(
          t.wallMask & (t.engraving ?? 0),
        ).flatMap((s) => {
          const r = graphics.get(`ENGRAVED_STONE_WALL_${s}`);
          return r ? [r] : [];
        });
        if (engravedRims.length) {
          t.wallRim = [...(t.wallRim ?? []), ...engravedRims];
          t.wallRimTint = [255, 255, 255];
          if (carvingPalette) t.wallRimPalette = carvingPalette;
          if (tone) t.wallRimTone = tone;
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
      (engraved && t.shape === "floor" ? engraving : undefined) ??
      grassArt ??
      graphics.get(t.shape === "wall" ? wall : floor) ??
      graphics.get(floor);
    const side = graphics.get(grass ? "DIRT_FLOOR_5" : floor) ?? top;
    if (top && side)
      t.surfaces = {
        top,
        side,
        ...(glass ? { darkBacking: true as const } : {}),
        ...(engraved && t.shape === "floor" && carvingPalette
          ? { palette: carvingPalette }
          : surfacePalette
            ? { palette: surfacePalette }
            : {}),
        ...(engraved && t.shape === "floor" && tone ? { topTone: tone } : {}),
        ...(engraving && t.shape === "wall"
          ? {
              engraving,
              ...(carvingPalette ? { engravingPalette: carvingPalette } : {}),
              ...(tone ? { engravingTone: tone } : {}),
            }
          : {}),
        ...(grassArt || t.shape !== "wall" || finished || ice
          ? { topTint: [255, 255, 255] as [number, number, number] }
          : {}),
        ...(surfacePalette || finished || ice
          ? { sideTint: [255, 255, 255] as [number, number, number] }
          : {}),
      };
  }
}
