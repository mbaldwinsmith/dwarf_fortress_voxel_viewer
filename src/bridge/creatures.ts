import type { FortressAdapter } from "./adapter.js";
import {
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
    Number(z) <= level &&
    Number(z) >= Math.max(b.z, level - 2) &&
    !!tileAt(chunks, Number(x), Number(y), Number(z)) &&
    tileAt(chunks, Number(x), Number(y), Number(z))?.shape !== "unknown"
  );
}
export class CreatureReader {
  raws = new Map<number, { id: string; castes: Map<number, string> }>();
  constructor(
    private adapter: FortressAdapter,
    private graphics: Graphics,
  ) {}
  async snapshot(
    b: Bounds,
    level: number,
    chunks: Map<string, Chunk>,
  ): Promise<Creature[]> {
    const data = await this.adapter.rpc.call("GetUnitListInside", {
      minX: b.x / 16,
      maxX: (b.x + b.width) / 16,
      minY: b.y / 16,
      maxY: (b.y + b.depth) / 16,
      minZ: Math.max(b.z, level - 2),
      maxZ: level + 1,
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
            castes: new Map(
              ((raw.caste ?? []) as Record<string, unknown>[]).map((c) => [
                Number(c.index),
                String(c.casteId),
              ]),
            ),
          });
      }
      const raw = this.raws.get(race.matType),
        sprite = raw
          ? this.graphics.resolve(
              raw.id,
              raw.castes.get(Number(race.matIndex)) ?? "",
            )
          : undefined;
      result.push({
        id: Number(u.id),
        x: Number(u.posX),
        y: Number(u.posY),
        z: Number(u.posZ),
        name:
          typeof u.name === "string"
            ? u.name.slice(0, 120)
            : (raw?.id ?? "Creature"),
        ...(sprite ? { sprite } : {}),
      });
    }
    return result;
  }
}
