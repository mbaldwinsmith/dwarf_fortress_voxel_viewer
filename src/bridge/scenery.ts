import type { Bounds, Chunk, SceneryObject } from "../shared/model.js";
import type { Rpc } from "./rpc.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
import { textureTerrain } from "./terrain-art.js";
const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
export const buildingKey = (t: Record<string, unknown>) =>
  `${t.buildingType},${t.buildingSubtype},${t.buildingCustom}`;
const workshop: Record<string, string> = {
  Carpenters: "CARPENTER",
  Farmers: "FARMER",
  Masons: "MASON",
  Craftsdwarfs: "CRAFTS",
  Jewelers: "JEWELER",
  MetalsmithsForge: "METALSMITH",
  MagmaForge: "MAGMAFORGE",
  Bowyers: "BOWYER",
  Mechanics: "MECHANIC",
  Butchers: "BUTCHER",
  Leatherworks: "LEATHER",
  Tanners: "TANNER",
  Clothiers: "CLOTHES",
  Fishery: "FISHERY",
  Still: "STILL",
  Loom: "LOOM",
  Kitchen: "KITCHEN",
  Ashery: "ASHERY",
  Dyers: "DYER",
  Quern: "QUERN",
  Millstone: "MILLSTONE",
  SOAP_MAKER: "CUSTOM:SOAP_MAKER",
  SCREW_PRESS: "CUSTOM:SCREW_PRESS",
};
const furnace: Record<string, string> = {
  WoodFurnace: "WOOD",
  Smelter: "SMELTER",
  GlassFurnace: "GLASS",
  Kiln: "KILN",
  MagmaSmelter: "SMELTER_LAVA",
  MagmaGlassFurnace: "GLASS_LAVA",
  MagmaKiln: "KILN_LAVA",
};
const furniture: Record<string, string> = {
  Bed: "BED",
  Chair: "CHAIR",
  Table: "TABLE",
  Coffin: "COFFIN",
  Box: "BOX",
  Cabinet: "CABINET",
  Door: "DOOR",
  Hatch: "HATCH_COVER",
  GrateFloor: "GRATE",
  Slab: "SLAB",
  Bookcase: "BOOKCASE",
  TractionBench: "TRACTION_BENCH",
};
export function buildingObjects(
  chunk: Chunk,
  buildings: unknown,
  definitions: Map<string, string>,
  graphics: Pick<SceneryGraphics, "get">,
): SceneryObject[] {
  const out: SceneryObject[] = [];
  for (const b of records(buildings)) {
    const type = b.buildingType as Record<string, unknown> | undefined;
    if (!type) continue;
    const id =
      definitions.get(buildingKey(type)) ??
      definitions.get(`${type.buildingType},-1,-1`);
    if (!id) continue;
    const [category, subtype] = id.split("/"),
      isShop =
        category === "Workshop" ||
        category === "Furnace" ||
        category === "TradeDepot";
    if (!isShop && !furniture[category]) continue;
    const x1 = b.posXMin,
      y1 = b.posYMin,
      x2 = b.posXMax,
      y2 = b.posYMax,
      z = b.posZMax;
    if (
      ![x1, y1, x2, y2, z, b.index].every(
        (n) => typeof n === "number" && Number.isSafeInteger(n),
      )
    )
      continue;
    const left = Number(x1),
      top = Number(y1),
      right = Number(x2),
      bottom = Number(y2);
    if (
      z !== chunk.z ||
      left > right ||
      top > bottom ||
      right - left > 30 ||
      bottom - top > 30
    )
      continue;
    const mat = b.material as Record<string, unknown> | undefined,
      material = mat?.matType === 0 ? "STONE" : "WOOD";
    const prefix =
      category === "Workshop"
        ? workshop[subtype]
          ? `WORKSHOP_${workshop[subtype]}`
          : undefined
        : category === "Furnace"
          ? furnace[subtype]
            ? `FURNACE_${furnace[subtype]}`
            : undefined
          : "TRADE_DEPOT";
    for (
      let y = Math.max(top, chunk.y);
      y <= Math.min(bottom, chunk.y + 15);
      y++
    )
      for (
        let x = Math.max(left, chunk.x);
        x <= Math.min(right, chunk.x + 15);
        x++
      ) {
        const tile = chunk.tiles[(y - chunk.y) * 16 + x - chunk.x];
        if (
          !tile ||
          tile.shape === "unknown" ||
          tile.shape === "empty" ||
          tile.shape === "wall"
        )
          continue;
        let sprite, overlay;
        if (isShop && prefix) {
          // Vanilla multi-tile art has one decorative row above its footprint.
          const extraRow = right - left > 0 ? 1 : 0;
          sprite =
            graphics.get(`${prefix}:3:${x - left}:${y - top + extraRow}`) ??
            graphics.get(`${prefix}:1:${x - left}:${y - top + extraRow}`);
          const overlayPrefix = prefix.replace(
            /^(WORKSHOP_[^:]+|FURNACE_[^:]+|TRADE_DEPOT)/,
            "$1_OVERLAY",
          );
          overlay =
            graphics.get(
              `${overlayPrefix}:3:${x - left}:${y - top + extraRow}`,
            ) ??
            graphics.get(
              `${overlayPrefix}:1:${x - left}:${y - top + extraRow}`,
            );
        } else if (!isShop) {
          const token = `ITEM_${furniture[category]}`;
          sprite =
            category === "Door"
              ? b.active === 0
                ? graphics.get(`${token}_${material}_OPEN`)
                : graphics.get(`${token}_${material}_CLOSED:ALL`)
              : undefined;
          sprite ??=
            graphics.get(`${token}_${material}:1`) ??
            graphics.get(`${token}_${material}`) ??
            graphics.get(token);
        }
        out.push({
          id: `b:${b.index}:${x}:${y}`,
          x,
          y,
          z: chunk.z,
          name: id,
          kind: category === "Door" ? "door" : "ground",
          ...(sprite ? { sprite } : {}),
          ...(overlay ? { overlay } : {}),
        });
        if (out.length >= 512) return out;
      }
  }
  return out;
}
export function plantObjects(
  chunk: Chunk,
  plants: unknown,
  definitions: Map<number, { id: string; name: string }>,
  graphics: Pick<SceneryGraphics, "get">,
  materials?: unknown,
): SceneryObject[] {
  const out: SceneryObject[] = [];
  const mats = Array.isArray(materials) ? materials : [];
  const occupied = new Set<number>();
  for (let i = 0; i < 256; i++) {
    const tile = chunk.tiles[i],
      mat = mats[i];
    const young = tile?.material === 12 && /sapling|shrub/i.test(tile.name);
    if (
      (!tile?.treeGraphic && !young) ||
      tile.shape === "unknown" ||
      !mat ||
      Number(mat.matType) < 419 ||
      Number(mat.matType) >= 619
    )
      continue;
    const d = definitions.get(Number(mat.matIndex));
    if (!d) continue;
    const token =
      tile.treeGraphic ??
      `${/sapling/i.test(tile.name) ? "SAPLING" : "SHRUB"}${/dead/i.test(tile.name) ? "_DEAD" : ""}`;
    const sprite =
      graphics.get(`PLANT:${d.id}:${token}`) ?? graphics.get(token);
    if (!sprite) continue;
    const x = chunk.x + (i % 16),
      y = chunk.y + Math.floor(i / 16);
    out.push({
      id: `p:${x}:${y}:${chunk.z}`,
      x,
      y,
      z: chunk.z,
      name: d.name,
      kind: "plant",
      sprite,
    });
    occupied.add(i);
  }
  for (const p of records(plants)) {
    const x = Number(p.posX),
      y = Number(p.posY),
      z = Number(p.posZ);
    if (
      ![x, y, z].every(Number.isSafeInteger) ||
      z !== chunk.z ||
      x < chunk.x ||
      x >= chunk.x + 16 ||
      y < chunk.y ||
      y >= chunk.y + 16
    )
      continue;
    const tile = chunk.tiles[(y - chunk.y) * 16 + x - chunk.x];
    if (occupied.has((y - chunk.y) * 16 + x - chunk.x)) continue;
    // Position records are a fallback for plants without usable tile material data.
    if (
      !tile ||
      tile.shape === "unknown" ||
      tile.shape === "wall" ||
      tile.shape === "empty"
    )
      continue;
    const d = definitions.get(Number(p.index));
    if (!d) continue;
    const sapling = /sapling/i.test(tile.name),
      dead = /dead/i.test(tile.name),
      state = `${sapling ? "SAPLING" : "SHRUB"}${dead ? "_DEAD" : ""}`;
    const sprite =
      graphics.get(`PLANT:${d.id}:${state}`) ??
      graphics.get(sapling ? "SAPLING" : "SHRUB");
    out.push({
      id: `p:${x}:${y}:${z}`,
      x,
      y,
      z,
      name: d.name,
      kind: "plant",
      ...(sprite ? { sprite } : {}),
    });
    if (out.length >= 256) return out;
  }
  return out;
}
export class SceneryReader {
  private definitions = new Map<string, string>();
  private plantDefinitions = new Map<number, { id: string; name: string }>();
  private plants: Record<string, unknown>[] = [];
  private lastPlants = -Infinity;
  constructor(
    private rpc: Rpc,
    private graphics: SceneryGraphics,
    private bounds: Bounds,
  ) {}
  async initialize() {
    const defs = await this.rpc.call("GetBuildingDefList");
    for (const d of records(defs.buildingList))
      if (d.buildingType && typeof d.id === "string")
        this.definitions.set(
          buildingKey(d.buildingType as Record<string, unknown>),
          d.id,
        );
    const raws = await this.rpc.call("GetPlantRaws");
    for (const p of records(raws.plantRaws))
      if (typeof p.index === "number" && typeof p.id === "string")
        this.plantDefinitions.set(p.index, {
          id: p.id,
          name: String(p.name ?? p.id).slice(0, 120),
        });
  }
  async decorate(chunk: Chunk, raw?: Record<string, unknown>) {
    textureTerrain(chunk, this.graphics, raw?.materials);
    if (performance.now() - this.lastPlants >= 5000) {
      const b = this.bounds;
      // GetPlantList iterates 3x3-block columns and requires whole tree bounds in Z.
      // Query the bounded local map, then apply strict per-tile visibility below.
      const list = await this.rpc.call("GetPlantList", {
        minX: 0,
        minY: 0,
        maxX: Math.ceil(b.width / 48) * 3,
        maxY: Math.ceil(b.depth / 48) * 3,
        minZ: 0,
        maxZ: b.height,
      });
      this.plants = records(list.plantList).slice(0, 32768);
      this.lastPlants = performance.now();
    }
    chunk.objects = [
      ...buildingObjects(
        chunk,
        raw?.buildings,
        this.definitions,
        this.graphics,
      ),
      ...plantObjects(
        chunk,
        this.plants,
        this.plantDefinitions,
        this.graphics,
        raw?.materials,
      ),
    ];
  }
}
