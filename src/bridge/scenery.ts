import type { Bounds, Chunk, SceneryObject } from "../shared/model.js";
import type { Rpc } from "./rpc.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
import { textureTerrain, terrainMaterials } from "./terrain-art.js";
import { groundItems, materialFamily } from "./ground-items.js";
import { flowTokens } from "./flows.js";
import type { Graphics } from "./graphics.js";
import type { SpriteLayer } from "../shared/model.js";
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
  Floodgate: "FLOODGATE",
  Hatch: "HATCH_COVER",
  GrateFloor: "GRATE",
  GrateWall: "GRATE",
  Slab: "SLAB",
  Bookcase: "TOOL_BOOKCASE",
  TractionBench: "TRACTION_BENCH",
  NestBox: "TOOL_NEST_BOX",
  Hive: "TOOL_HIVE",
  Armorstand: "ARMOR_STAND",
  Weaponrack: "WEAPON_RACK",
  Cage: "CAGE",
  AnimalTrap: "ANIMAL_TRAP",
  Statue: "STATUE_ITEM",
  OfferingPlace: "TOOL_ALTAR",
  DisplayFurniture: "TOOL_PEDESTAL",
};
const uprightFurniture = new Set([
  "Statue",
  "OfferingPlace",
  "DisplayFurniture",
]);
const meshFurniture = new Set([
  "Table",
  "Chair",
  "Bed",
  "Cabinet",
  "Coffin",
  "Bookcase",
  "Box",
  "Cage",
  "AnimalTrap",
  "Armorstand",
  "Weaponrack",
  "NestBox",
  "Hive",
  "Door",
  "Floodgate",
  "Hatch",
  "GrateFloor",
  "GrateWall",
]);
const barriers = new Set([
  "Door",
  "Floodgate",
  "Hatch",
  "GrateFloor",
  "GrateWall",
]);
export function buildingObjects(
  chunk: Chunk,
  buildings: unknown,
  definitions: Map<string, string>,
  graphics: Pick<SceneryGraphics, "get">,
  materialDefinitions?: ReturnType<typeof terrainMaterials>,
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
      definition =
        mat && materialDefinitions?.get(`${mat.matType},${mat.matIndex}`),
      material = definition
        ? materialFamily(definition.id, (graphics as SceneryGraphics).metalIds)
        : mat?.matType === 0
          ? "STONE"
          : "WOOD";
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
          (tile.shape === "empty" && !barriers.has(category)) ||
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
            category === "Hive"
              ? graphics.get("ITEM_TOOL_HIVE_BUILDING")
              : barriers.has(category)
                ? category.startsWith("Grate")
                  ? graphics.get(
                      `${token}_${material}_${category === "GrateFloor" ? "FLOOR" : "WALL"}_CLOSED`,
                    )
                  : (graphics.get(`${token}_${material}_CLOSED:ALL`) ??
                    graphics.get(`${token}_${material}_CLOSED:1`))
                : undefined;
          sprite ??=
            (["Armorstand", "Weaponrack"].includes(category)
              ? graphics.get(`${token}_${material}_EMPTY`)
              : undefined) ??
            graphics.get(`${token}_${material}:1`) ??
            graphics.get(`${token}_${material}`) ??
            graphics.get(token);
        }
        const tint =
          isShop && mat
            ? materialDefinitions?.get(`${mat.matType},${mat.matIndex}`)?.color
            : undefined;
        const matDef =
          mat && materialDefinitions?.get(`${mat.matType},${mat.matIndex}`);
        const palette =
          meshFurniture.has(category) && matDef
            ? (graphics as SceneryGraphics).materialPalettes?.get(matDef.id)
            : undefined;
        const details: NonNullable<SceneryObject["details"]> = [];
        if (category === "Bed") {
          const item = records(b.items)
            .map((v) => v.item as Record<string, unknown>)
            .find((v) => v && typeof v.id === "number");
          const seed = Number(item?.id ?? b.index) >>> 0;
          // RFR omits the game's sheet/pillow graphic seed. Use stable native
          // layers and a muted palette; these are explicitly approximate styles.
          const colors: [number, number, number][] = [
            [245, 245, 230],
            [190, 225, 185],
            [235, 185, 225],
            [255, 220, 150],
            [235, 170, 135],
            [205, 220, 225],
          ];
          const sheet = graphics.get(
            `ITEM_BED_SHEET_VARIANT:${(seed % 2) + 1}`,
          );
          const pillow = graphics.get(
            `ITEM_BED_PILLOW_VARIANT:${(seed % 3) + 1}`,
          );
          if (sheet)
            details.push({
              sprite: sheet,
              tint: colors[seed % colors.length],
              brightness: 3.4,
            });
          if (pillow) details.push({ sprite: pillow });
        }
        out.push({
          id: `b:${b.index}:${x}:${y}`,
          x,
          y,
          z: chunk.z,
          name: id,
          ...(meshFurniture.has(category)
            ? {
                furniture: {
                  type: (category === "Box"
                    ? "chest"
                    : category.toLowerCase()) as NonNullable<
                    SceneryObject["furniture"]
                  >["type"],
                  ...(material === "STONE" ? { heavy: true as const } : {}),
                  ...(definition?.color ? { color: definition.color } : {}),
                  ...(barriers.has(category) ? { open: b.active === 0 } : {}),
                },
              }
            : {}),
          kind: meshFurniture.has(category)
            ? "ground"
            : category === "Door"
              ? "door"
              : uprightFurniture.has(category)
                ? "upright"
                : "ground",
          ...(sprite ? { sprite } : {}),
          ...(overlay ? { overlay } : {}),
          ...(tint ? { tint } : {}),
          ...(palette ? { palette } : {}),
          ...(details.length ? { details } : {}),
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
    if (tile.treeGraphic) {
      const ref = (name: string) =>
        graphics.get(`PLANT:${d.id}:${name}`) ?? graphics.get(name);
      const species = (name: string) => graphics.get(`PLANT:${d.id}:${name}`);
      tile.tree = {
        ...tile.tree,
        species: d.name,
        bark: ref("TREE_TRUNK_PILLAR") ?? sprite,
        side:
          species("TREE_TRUNK_SLOPE_NSWE") ??
          species("TREE_TRUNK_SLOPE_NSW") ??
          species("TREE_TRUNK_NSWE") ??
          species("TREE_TRUNK_THICK_INTERIOR") ??
          species("TREE_TRUNK_PILLAR") ??
          ref("TREE_TRUNK_SLOPE_NSWE") ??
          sprite,
        leaves: ref(`TREE_TWIGS_FULL${1 + (i % 4)}`) ?? ref("TREE_TWIGS"),
        cap: sprite,
        capSurface: ref("TREE_CAP_THICK_INTERIOR"),
        ...(species("TREE_CAP_THICK_INTERIOR") || d.id === "FUNGIWOOD"
          ? { roundStem: true as const }
          : {}),
      };
      occupied.add(i);
      continue;
    }
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
  private corpses = new Map<number, SpriteLayer[]>();
  private itemDefinitions = new Map<string, string>();
  private materialDefinitions = terrainMaterials([]);
  private definitions = new Map<string, string>();
  private plantDefinitions = new Map<number, { id: string; name: string }>();
  private plants: Record<string, unknown>[] = [];
  private lastPlants = -Infinity;
  constructor(
    private rpc: Rpc,
    private graphics: SceneryGraphics,
    private bounds: Bounds,
    private creatureGraphics?: Graphics,
  ) {}
  async prepareCorpses(blocks: { chunk: Chunk; items: unknown }[]) {
    if (!this.creatureGraphics) return;
    const ids = new Set<number>();
    for (const { chunk, items } of blocks) {
      const visible = new Set(
        groundItems(
          chunk,
          items,
          this.itemDefinitions,
          this.materialDefinitions,
          this.graphics,
        ).map((o) => Number(o.id.slice(2))),
      );
      for (const item of records(items)) {
        const id = Number(item.id),
          type = item.type as Record<string, unknown> | undefined;
        if (
          type &&
          visible.has(id) &&
          !this.corpses.has(id) &&
          (this.itemDefinitions.get(`${type.matType},${type.matIndex}`) ??
            this.itemDefinitions.get(`${type.matType},-1`)) === "CORPSE"
        )
          ids.add(id);
      }
    }
    const batch = [...ids].slice(0, 512);
    if (!batch.length) return;
    const identities = await this.rpc.corpseIdentities(batch);
    for (const id of batch) this.corpses.set(id, []);
    for (const c of identities)
      this.corpses.set(
        c.id,
        this.creatureGraphics.corpse(c.race, c.caste, c.child),
      );
    while (this.corpses.size > 8192)
      this.corpses.delete(this.corpses.keys().next().value!);
  }
  async initialize() {
    const items = await this.rpc.call("GetItemList");
    for (const d of records(items.materialList)) {
      const p = d.matPair as Record<string, unknown> | undefined;
      if (p && typeof d.id === "string")
        this.itemDefinitions.set(`${p.matType},${p.matIndex}`, d.id);
    }
    const materialList = await this.rpc.call("GetMaterialList");
    this.materialDefinitions = terrainMaterials(materialList.materialList);
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
  withItems(chunk: Chunk, items: unknown): Chunk {
    const objects = (chunk.objects ?? []).filter((o) => !o.id.startsWith("i:"));
    return {
      ...chunk,
      objects: [
        ...objects,
        ...groundItems(
          chunk,
          items,
          this.itemDefinitions,
          this.materialDefinitions,
          this.graphics,
          this.corpses,
        ).slice(0, Math.max(0, 512 - objects.length)),
      ],
    };
  }
  withBuildings(chunk: Chunk, buildings: unknown): Chunk {
    const objects = (chunk.objects ?? []).filter((o) => !o.id.startsWith("b:"));
    return {
      ...chunk,
      objects: [
        ...buildingObjects(
          chunk,
          buildings,
          this.definitions,
          this.graphics,
          this.materialDefinitions,
        ),
        ...objects,
      ].slice(0, 512),
    };
  }
  async decorate(chunk: Chunk, raw?: Record<string, unknown>) {
    // Constant artwork, independent of hidden tile materials and ore veins.
    chunk.ceilingTexture = this.graphics.get("STONE_FLOOR_5");
    for (const flow of chunk.flows ?? []) {
      flow.frames = [1, 2, 3, 4].flatMap((i) => {
        const ref = this.graphics.get(`${flowTokens[flow.kind]}:${i}`);
        return ref ? [ref] : [];
      });
    }
    textureTerrain(chunk, this.graphics, raw?.materials, {
      definitions: this.materialDefinitions,
      plants: this.plantDefinitions,
      gems: this.graphics.gemIds,
      ores: this.graphics.oreIds,
      layerMaterials: raw?.layerMaterials,
      baseMaterials: raw?.baseMaterials,
    });
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
        this.materialDefinitions,
      ),
      ...plantObjects(
        chunk,
        this.plants,
        this.plantDefinitions,
        this.graphics,
        raw?.materials,
      ),
    ];
    for (let i = 0; i < 256; i++)
      if (chunk.tiles[i].shape === "stairs") {
        const t = chunk.tiles[i],
          x = chunk.x + (i % 16),
          y = chunk.y + Math.floor(i / 16);
        const direction = /up.down|updown/i.test(t.name)
          ? "UPDOWN"
          : /down/i.test(t.name)
            ? "DOWN"
            : "UP";
        const sprite = this.graphics.get(`STONE_STAIR_${direction}`);
        if (sprite)
          chunk.objects.push({
            id: `s:${x}:${y}:${chunk.z}`,
            x,
            y,
            z: chunk.z,
            name: t.name,
            kind: "ground",
            sprite,
          });
      }
    const designations = raw?.tileDigDesignation;
    if (Array.isArray(designations) && designations.length === 256) {
      const tokens = [
        "",
        "STANDARD",
        "STAIR_UPDOWN",
        "CHANNEL",
        "RAMP",
        "STAIR_DOWN",
        "STAIR_UP",
      ];
      for (let i = 0; i < 256; i++) {
        const designation = designations[i];
        const tile = chunk.tiles[i];
        if (
          !Number.isInteger(designation) ||
          designation < 1 ||
          designation > 6 ||
          ["empty", "unknown"].includes(tile.shape)
        )
          continue;
        const sprite = this.graphics.get(
          `DESIGNATION_DIG_${tokens[designation]}`,
        );
        if (sprite)
          chunk.objects.push({
            id: `d:${chunk.x + (i % 16)}:${chunk.y + Math.floor(i / 16)}:${chunk.z}`,
            x: chunk.x + (i % 16),
            y: chunk.y + Math.floor(i / 16),
            z: chunk.z,
            kind: "ground",
            name: "Mining designation",
            sprite,
          });
      }
    }
    await this.prepareCorpses([{ chunk, items: raw?.items }]);
    chunk.objects = this.withItems(chunk, raw?.items).objects?.slice(0, 512);
  }
}
