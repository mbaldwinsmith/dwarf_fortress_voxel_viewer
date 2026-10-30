import { tileAt, type Chunk, type Projectile } from "../shared/model.js";
import type { SceneryGraphics } from "./scenery-graphics.js";
import type { TerrainMaterial } from "./terrain-art.js";
import { materialFamily, itemAliases } from "./ground-items.js";

const pair = (v: Record<string, number>) => `${v.matType},${v.matIndex}`;
const finite = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** The first RFR block contains all physical projectiles, regardless of region.
 * Filter against revealed cached terrain before anything crosses the socket. */
export function visibleProjectiles(
  raw: unknown,
  chunks: Map<string, Chunk>,
  definitions: Map<string, string>,
  materials: Map<string, TerrainMaterial>,
  graphics: Pick<SceneryGraphics, "get" | "metalIds">,
): Projectile[] {
  const found = new Map<number, Projectile>();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (
      !item ||
      item.projectile !== true ||
      !Number.isSafeInteger(item.id) ||
      item.id < 0 ||
      !item.pos ||
      !item.type
    )
      continue;
    const pos = item.pos;
    if (![pos.x, pos.y, pos.z].every(Number.isSafeInteger)) continue;
    // Flying items are usually NOT on_ground. Do not apply ground-item flags.
    const tile = tileAt(chunks, pos.x, pos.y, pos.z);
    if (!tile || tile.shape === "unknown") continue;
    const x = pos.x + finite(item.subposX),
      y = pos.y + finite(item.subposY),
      z = pos.z + finite(item.subposZ);
    if ([x, y, z].some((v) => Math.abs(v) >= 1000000)) continue;
    const target = tileAt(
      chunks,
      Math.floor(x + 0.5),
      Math.floor(y + 0.5),
      Math.floor(z + 0.5),
    );
    if (!target || target.shape === "unknown") continue;
    const id =
      definitions.get(pair(item.type)) ??
      definitions.get(`${item.type.matType},-1`) ??
      "ITEM";
    const [category, subtype] = id.split("/");
    const material = item.material
      ? materials.get(pair(item.material))
      : undefined;
    const family = materialFamily(material?.id, graphics.metalIds);
    const kind: Projectile["kind"] =
      category === "SIEGEAMMO"
        ? "ballista"
        : category === "AMMO"
          ? subtype?.includes("ARROW")
            ? "arrow"
            : "bolt"
          : ["BOULDER", "ROCK"].includes(category)
            ? "stone"
            : "item";
    const token = itemAliases[category] ?? category;
    const sprite =
      (subtype &&
        graphics.get(`${subtype}:${family === "WOOD" ? "WOOD" : "DEFAULT"}`)) ||
      (category === "BOULDER" &&
        material &&
        graphics.get(`BOULDER_GRAPHICS:${material.id}`)) ||
      (subtype && graphics.get(subtype)) ||
      graphics.get(`ITEM_${token}`) ||
      graphics.get(`ITEM_${token}_${family}:1`) ||
      graphics.get(`ITEM_${token}_${family}`);
    found.set(item.id, {
      id: item.id,
      x,
      y,
      z,
      velocity: [
        finite(item.velocityX),
        finite(item.velocityY),
        finite(item.velocityZ),
      ].map((v) => Math.max(-10000, Math.min(10000, v))) as [
        number,
        number,
        number,
      ],
      kind,
      name: `${material?.name ?? ""} ${(subtype ?? category)
        .replace(/^ITEM_(?:AMMO_|SIEGEAMMO_|WEAPON_)?/, "")
        .toLowerCase()
        .replaceAll("_", " ")}`
        .trim()
        .slice(0, 120),
      size:
        kind === "ballista"
          ? 1.6
          : kind === "arrow"
            ? 0.9
            : kind === "bolt"
              ? 0.65
              : Math.max(
                  0.18,
                  Math.min(
                    0.85,
                    Math.cbrt(Math.max(0, finite(item.volume, 1000)) / 100000),
                  ),
                ),
      color: material?.color ?? [160, 148, 120],
      ...(sprite ? { sprite } : {}),
    });
    if (found.size >= 512) break;
  }
  return [...found.values()];
}
