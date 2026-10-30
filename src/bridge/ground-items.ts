import type { Chunk, SceneryObject, SpriteLayer } from "../shared/model.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
import type { TerrainMaterial } from "./terrain-art.js";

const key = (p: Record<string, unknown>) => `${p.matType},${p.matIndex}`;
const aliases: Record<string, string> = {
  BAR: "BARS",
  ROUGH: "ROUGH_GEM",
  SMALLGEM: "CUT_GEM",
  FOOD: "PREPARED_MEAL",
  BOX: "BOX",
  SKIN_TANNED: "LEATHER",
  CORPSEPIECE: "REMAINS",
  // Unknown/unsupported species retain the native remains fallback.
  CORPSE: "REMAINS",
  ROCK: "ROCK",
  EGG: "EGG_SIZE1",
  SLAB: "SLAB_BLANK",
  STATUE: "STATUE_ITEM",
  HATCH_COVER: "HATCH_COVER",
};
// item_flags from the pinned df-structures: held/container contents, removed,
// installed furniture, construction, encased, deleted, interface-hidden.
const excluded =
  (1 << 3) |
  (1 << 4) |
  (1 << 5) |
  (1 << 10) |
  (1 << 11) |
  (1 << 17) |
  (1 << 24);

export function groundItems(
  chunk: Chunk,
  raw: unknown,
  definitions: Map<string, string>,
  materials: Map<string, TerrainMaterial>,
  graphics: Pick<SceneryGraphics, "get"> &
    Partial<Pick<SceneryGraphics, "materialPalettes">>,
  corpses?: ReadonlyMap<number, SpriteLayer[]>,
): SceneryObject[] {
  const cells = new Map<number, SceneryObject>();
  const items = Array.isArray(raw) ? raw : [];
  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id < 0 ||
      !Number.isInteger(item.flags1) ||
      !(item.flags1 & 1) ||
      item.flags1 & excluded ||
      item.projectile === true ||
      !item.pos ||
      !item.type
    )
      continue;
    const { x, y, z } = item.pos;
    if (
      ![x, y, z].every(Number.isInteger) ||
      z !== chunk.z ||
      x < chunk.x ||
      x >= chunk.x + 16 ||
      y < chunk.y ||
      y >= chunk.y + 16
    )
      continue;
    const cell = (y - chunk.y) * 16 + x - chunk.x;
    if (!["floor", "ramp", "stairs"].includes(chunk.tiles[cell].shape))
      continue;
    const id =
      definitions.get(key(item.type)) ??
      definitions.get(`${item.type.matType},-1`);
    if (!id) continue;
    const [category, subtype] = id.split("/");
    const material = item.material
      ? materials.get(key(item.material))
      : undefined;
    const override = {
      BOULDER: "BOULDER_GRAPHICS",
      ROUGH: "ROUGH_GEM_GRAPHICS",
      BAR: "BARS_GRAPHICS",
    }[category];
    const token = aliases[category] ?? category;
    const family = material?.id.startsWith("INORGANIC:") ? "STONE" : "WOOD";
    const corpse = category === "CORPSE" ? corpses?.get(item.id) : undefined;
    const sprite =
      corpse?.[0]?.sprite ||
      (override && material && graphics.get(`${override}:${material.id}`)) ||
      (subtype && graphics.get(subtype)) ||
      graphics.get(`ITEM_${token}`) ||
      graphics.get(`ITEM_${token}_${family}:1`) ||
      graphics.get(`ITEM_${token}_${family}`);
    if (!sprite) continue;
    const o: SceneryObject = {
      id: `i:${item.id}`,
      x,
      y,
      z,
      kind: "ground",
      sprite,
      ...(corpse?.length
        ? {
            ...(corpse[0].tint ? { tint: corpse[0].tint } : {}),
            ...(corpse[0].palette ? { palette: corpse[0].palette } : {}),
            details: corpse
              .slice(1)
              .map((layer) => ({ ...layer, brightness: 1 })),
          }
        : {}),
      name: `${material?.name ?? ""} ${category.toLowerCase().replaceAll("_", " ")}`
        .trim()
        .slice(0, 120),
    };
    const palette = material && graphics.materialPalettes?.get(material.id);
    if (
      palette &&
      ["BOULDER", "ROUGH", "SMALLGEM", "BAR", "BLOCKS"].includes(category)
    )
      o.palette = palette;
    else if (
      ["BOULDER", "ROUGH", "SMALLGEM", "BAR", "BLOCKS", "WOOD"].includes(
        category,
      ) &&
      material?.color
    )
      o.tint = material.color;
    // DF displays one item graphic per occupied tile. Stable choice prevents
    // overlapping quads and flicker in stockpiles; stacks remain one graphic.
    const previous = cells.get(cell);
    if (!previous || item.id < Number(previous.id.slice(2))) cells.set(cell, o);
  }
  return [...cells.values()];
}
