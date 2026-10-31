import { professionCategories } from "./professions.js";
import { hairAppearance } from "./hair.js";
import { eyeColor, faceVariant } from "./face.js";
import type { WornItem } from "./dwarf-layers.js";
import type { FortressAdapter } from "./adapter.js";
import {
  LEVELS_ABOVE,
  LEVELS_BELOW,
  tileAt,
  type Bounds,
  type Chunk,
  type Creature,
} from "../shared/model.js";
import type { Graphics } from "./graphics.js";
// Verified against df-structures d8ff8a63 (matching installed DFHack):
// inactive, left, incoming, hidden_in_ambush, hidden_ambusher, caged.
const invisible =
  (1 << 1) | (1 << 8) | (1 << 10) | (1 << 18) | (1 << 21) | (1 << 25);
export function unitBodySize(u: Record<string, unknown>): number | undefined {
  const size = u.sizeInfo as Record<string, unknown> | undefined;
  for (const value of [size?.sizeCur, size?.sizeBase])
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= 2147483647
    )
      // DF's internal volume is raw cubic centimetres / 10 (also documented
      // by DFHack gui/unit-info-viewer's format_size_in_cc).
      return value * 10;
  return undefined;
}
export function visibleUnit(
  u: Record<string, unknown>,
  b: Bounds,
  level: number,
  chunks: Map<string, Chunk>,
): boolean {
  const { id, posX: x, posY: y, posZ: z, flags1 } = u;
  return (
    [id, x, y, z, flags1].every(
      (n) => typeof n === "number" && Number.isSafeInteger(n),
    ) &&
    Number(id) >= 0 &&
    (Number(flags1) & invisible) === 0 &&
    Number(x) >= b.x &&
    Number(x) < b.x + b.width &&
    Number(y) >= b.y &&
    Number(y) < b.y + b.depth &&
    Number(z) <= Math.min(b.z + b.height - 1, level + LEVELS_ABOVE) &&
    Number(z) >= Math.max(b.z, level - LEVELS_BELOW) &&
    !!tileAt(chunks, Number(x), Number(y), Number(z)) &&
    tileAt(chunks, Number(x), Number(y), Number(z))?.shape !== "unknown"
  );
}
export class CreatureReader {
  raws = new Map<
    number,
    {
      id: string;
      castes: Map<number, string>;
      details: Map<number, Record<string, unknown>>;
    }
  >();
  private itemDefs: Map<string, string> | undefined;
  private materialIds = new Map<string, string>();
  private materialColors = new Map<string, [number, number, number]>();
  private async metadata() {
    if (this.itemDefs) return;
    const items = await this.adapter.rpc.call("GetItemList"),
      materials = await this.adapter.rpc.call("GetMaterialList");
    this.itemDefs = new Map();
    for (const d of (items.materialList ?? []) as Record<string, unknown>[]) {
      const p = d.matPair as Record<string, unknown>;
      if (p && typeof d.id === "string")
        this.itemDefs.set(`${p.matType},${p.matIndex}`, d.id);
    }
    for (const d of (materials.materialList ?? []) as Record<
      string,
      unknown
    >[]) {
      const p = d.matPair as Record<string, unknown>,
        c = d.stateColor as Record<string, unknown> | undefined;
      if (p && typeof d.id === "string")
        this.materialIds.set(`${p.matType},${p.matIndex}`, d.id);
      if (p && c)
        this.materialColors.set(`${p.matType},${p.matIndex}`, [
          Number(c.red),
          Number(c.green),
          Number(c.blue),
        ]);
    }
  }
  constructor(
    private adapter: FortressAdapter,
    private graphics: Graphics,
  ) {}
  async snapshot(
    b: Bounds,
    level: number,
    chunks: Map<string, Chunk>,
  ): Promise<Creature[]> {
    await this.metadata();
    const data = await this.adapter.rpc.call("GetUnitListInside", {
      minX: b.x / 16,
      maxX: (b.x + b.width) / 16,
      minY: b.y / 16,
      maxY: (b.y + b.depth) / 16,
      minZ: Math.max(b.z, level - LEVELS_BELOW),
      maxZ: Math.min(b.z + b.height, level + LEVELS_ABOVE + 1),
    });
    // RFR emits partial out-of-region records before filtering; reject these.
    if (data.creatureList !== undefined && !Array.isArray(data.creatureList))
      throw Error("Invalid unit snapshot");
    const candidates = ((data.creatureList ?? []) as Record<string, unknown>[])
      .filter((u) => visibleUnit(u, b, level, chunks))
      .slice(0, 2000);
    let loaded = 0;
    const result: Creature[] = [];
    for (const u of candidates) {
      const race = u.race as Record<string, unknown> | undefined;
      if (
        !race ||
        typeof race.matType !== "number" ||
        !Number.isInteger(race.matType) ||
        race.matType < 0 ||
        race.matType > 100000
      )
        continue;
      if (!this.raws.has(race.matType) && loaded++ < 8) {
        const data = await this.adapter.rpc.call("GetPartialCreatureRaws", {
          listStart: race.matType,
          listEnd: race.matType + 1,
        });
        const raw = (
          data.creatureRaws as Record<string, unknown>[] | undefined
        )?.[0];
        if (
          raw &&
          raw.index === race.matType &&
          typeof raw.creatureId === "string"
        )
          this.raws.set(race.matType, {
            id: raw.creatureId,
            details: new Map(
              ((raw.caste ?? []) as Record<string, unknown>[]).map((c) => [
                Number(c.index),
                c,
              ]),
            ),
            castes: new Map(
              ((raw.caste ?? []) as Record<string, unknown>[]).map((c) => [
                Number(c.index),
                String(c.casteId),
              ]),
            ),
          });
      }
      const raw = this.raws.get(race.matType),
        bodySize = unitBodySize(u),
        sprite = raw
          ? this.graphics.resolve(
              raw.id,
              raw.castes.get(Number(race.matIndex)) ?? "",
              typeof u.age === "number" ? u.age : undefined,
            )
          : undefined;
      let layers: ReturnType<Graphics["dwarf"]> | undefined;
      if (
        raw &&
        this.graphics.supportsLayers(
          raw.id,
          raw.castes.get(Number(race.matIndex)) ?? "",
        )
      ) {
        const caste = raw.details.get(Number(race.matIndex)),
          appearance = u.appearance as Record<string, unknown> | undefined;
        const modifiers = (caste?.colorModifiers ?? []) as Record<
            string,
            unknown
          >[],
          colors = (appearance?.colors ?? []) as number[];
        let skin = "";
        for (let i = 0; i < modifiers.length; i++)
          if (String(modifiers[i].part).toUpperCase().includes("SKIN")) {
            const patterns = modifiers[i].patterns as Record<string, unknown>[];
            skin = String(patterns?.[colors[i]]?.id ?? "");
          }
        const parts = (caste?.bodyParts ?? []) as Record<string, unknown>[],
          items: WornItem[] = [];
        for (const inv of (u.inventory ?? []) as Record<string, unknown>[]) {
          if (![0, 1, 2, 4].includes(Number(inv.mode))) continue;
          const item = inv.item as Record<string, unknown> | undefined,
            p = item?.type as Record<string, unknown> | undefined;
          if (!item || !p) continue;
          const token = this.itemDefs?.get(`${p.matType},${p.matIndex}`),
            body = parts[Number(inv.bodyPartId)];
          if (!token || (!body && inv.mode !== 0)) continue;
          const [type, subtype] = token.split("/"),
            mat = item.material as Record<string, unknown> | undefined,
            dye = item.dye as Record<string, unknown> | undefined;
          const color = dye
            ? ([Number(dye.red), Number(dye.green), Number(dye.blue)] as [
                number,
                number,
                number,
              ])
            : mat
              ? this.materialColors.get(`${mat.matType},${mat.matIndex}`)
              : undefined;
          items.push({
            type,
            subtype,
            bodyToken: String(body?.token ?? ""),
            bodyCategory: String(body?.category ?? ""),
            mode: Number(inv.mode),
            materialType: mat
              ? this.materialIds
                  .get(`${mat.matType},${mat.matIndex}`)
                  ?.split(":")[0]
              : undefined,
            materialFlags: [
              ...(mat &&
              /^(PLANT|CREATURE):.*:WOOD$/.test(
                this.materialIds.get(`${mat.matType},${mat.matIndex}`) ?? "",
              )
                ? ["ANY_WOOD_MATERIAL"]
                : []),
              ...((Number(item.flags2) & 4) !== 0 ? ["GROWN_NOT_CRAFTED"] : []),
            ],
            color,
            artifact: (Number(item.flags1) & ((1 << 18) | (1 << 27))) !== 0,
          });
        }
        const categories = professionCategories(Number(u.professionId ?? -1));
        const state = categories.includes("BABY")
          ? "BABY"
          : categories.includes("CHILD")
            ? "CHILD"
            : u.professionId !== undefined
              ? "DEFAULT"
              : undefined;
        layers = this.graphics.layered(raw.id, {
          caste: raw.castes.get(Number(race.matIndex)) ?? "",
          age: Number(u.age ?? 30),
          skin,
          faceVariant: faceVariant(Number(u.id)),
          variantSeed: Number(u.id),
          eyeColor: eyeColor(caste ?? {}, appearance ?? {}),
          ...hairAppearance(caste ?? {}, appearance ?? {}, Number(u.age ?? 0)),
          items,
          state,
          professionCategories: categories,
          bodySize: bodySize ?? 0,
          haulCount: items.filter((i) => i.mode === 0).length,
          ghost: (Number(u.flags3) & (1 << 12)) !== 0,
        });
      }
      result.push({
        id: Number(u.id),
        x: Number(u.posX),
        y: Number(u.posY),
        z: Number(u.posZ),
        ...(bodySize !== undefined ? { bodySize } : {}),
        name:
          typeof u.name === "string"
            ? u.name.slice(0, 120)
            : (raw?.id ?? "Creature"),
        ...(sprite ? { sprite } : {}),
        ...(layers?.length ? { layers } : {}),
      });
    }
    return result;
  }
}
