import type { Bounds, Chunk, Shape, Tile } from "../shared/model.js";
import { Rpc } from "./rpc.js";
import type { SceneryReader } from "./scenery.js";
import { maskEnclosedWalls, openTile } from "./wall-visibility.js";
import { key } from "../shared/model.js";
import { visibleFlows } from "./flows.js";
function integer(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v))
    throw Error(`Invalid ${name}`);
  return v;
}
export function treeGraphicName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([a-z])([0-9])/g, "$1_$2")
    .toUpperCase()
    .replace(
      /(_CAP_WALL_)([NSWE]+)$/,
      (_m, p: string, d: string) => p + d.split("").join("_"),
    );
}
interface TileDefinition {
  variant?: number;
  smooth?: boolean;
  treeGraphic?: string;
  shape: number;
  material: number;
  name: string;
}
export function shapeFromDf(shape: number): Shape {
  if ([4, 5, 13, 17, 18, 19].includes(shape)) return "wall";
  if ([1, 2, 3, 11, 12, 14, 15].includes(shape)) return "floor";
  if ([6, 7, 8].includes(shape)) return "stairs";
  if (shape === 9) return "ramp";
  return "empty";
}
export function convertBlock(
  raw: Record<string, unknown> | undefined,
  x: number,
  y: number,
  z: number,
  defs: Map<number, TileDefinition>,
): Chunk {
  if (raw && (raw.mapX !== x || raw.mapY !== y || raw.mapZ !== z))
    throw Error("Unexpected map block coordinates");
  const tiles = raw?.tiles,
    hidden = raw?.hidden;
  for (const field of ["water", "magma"]) {
    const values = raw?.[field];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length !== 256 ||
        values.some((v) => !Number.isInteger(v) || v < 0 || v > 7))
    )
      throw Error(`Invalid ${field} depths`);
  }
  if (
    raw &&
    (!Array.isArray(tiles) ||
      tiles.length !== 256 ||
      !Array.isArray(hidden) ||
      hidden.length !== 256)
  )
    throw Error("Incomplete terrain/visibility response");
  const chunk: Chunk = {
    x,
    y,
    z,
    tiles: Array.from({ length: 256 }, (_, i): Tile => {
      if (!raw) return { shape: "empty", material: 0, name: "Open space" };
      if ((hidden as unknown[])[i] !== false)
        return { shape: "unknown", material: 0, name: "Undiscovered" };
      const d = defs.get(integer((tiles as unknown[])[i], "tile id"));
      if (!d) throw Error("Unknown DF tile type");
      const water = (raw.water as number[] | undefined)?.[i] ?? 0;
      const magma = (raw.magma as number[] | undefined)?.[i] ?? 0;
      const progress = (raw.treePercent as number[] | undefined)?.[i];
      if (water && magma) throw Error("Conflicting liquid types");
      return {
        ...(water || magma
          ? {
              liquid: {
                kind: magma ? ("magma" as const) : ("water" as const),
                depth: magma || water,
              },
            }
          : {}),
        shape: shapeFromDf(d.shape),
        material: d.material,
        name: d.name,
        ...(d.variant !== undefined ? { variant: d.variant } : {}),
        ...(d.smooth ? { smooth: true } : {}),
        ...(d.treeGraphic ? { treeGraphic: d.treeGraphic } : {}),
        ...(d.treeGraphic &&
        Number.isInteger(progress) &&
        progress! >= 0 &&
        progress! <= 100
          ? { tree: { progress } }
          : {}),
      };
    }),
  };
  const flows = visibleFlows(raw?.flows, chunk);
  if (flows.length) chunk.flows = flows;
  return chunk;
}
export class FortressAdapter {
  private openTerrain = new Map<string, Uint8Array>();
  scenery?: SceneryReader;
  rpc: Rpc;
  defs = new Map<number, TileDefinition>();
  identity = "";
  bounds!: Bounds;
  world = "";
  initialLevel = 0;
  constructor(port: number) {
    this.rpc = new Rpc(port);
  }
  async initialize() {
    await this.rpc.connect();
    const version = await this.rpc.call("GetVersionInfo");
    if (
      version.dwarfFortressVersion !== "53.16" ||
      version.dfhackVersion !== "53.16-r3" ||
      version.remoteFortressReaderVersion !== "0.21.0"
    )
      throw Error(
        `Unsupported versions: ${JSON.stringify(version)}. Verified schema: DF 53.16 / DFHack 53.16-r3 / RFR 0.21.0.`,
      );
    const map = await this.rpc.call("GetMapInfo");
    this.identity = JSON.stringify(map);
    this.world = String(map.worldNameEnglish ?? map.worldName ?? "Fortress");
    const view = await this.rpc.call("GetViewInfo");
    const sx = integer(map.blockSizeX, "map width"),
      sy = integer(map.blockSizeY, "map depth"),
      sz = integer(map.blockSizeZ, "map height");
    if (sx < 1 || sy < 1 || sz < 1 || sx > 1000 || sy > 1000 || sz > 1000)
      throw Error("Invalid map dimensions");
    this.initialLevel = Math.max(
      0,
      Math.min(sz - 1, integer(view.viewPosZ, "viewport Z")),
    );
    this.bounds = {
      x: 0,
      y: 0,
      z: 0,
      width: sx * 16,
      depth: sy * 16,
      height: sz,
    };
    const list = await this.rpc.call("GetTiletypeList");
    if (!Array.isArray(list.tiletypeList))
      throw Error("Invalid tile definitions");
    for (const d of list.tiletypeList as Record<string, unknown>[]) {
      this.defs.set(integer(d.id, "type id"), {
        shape: integer(d.shape, "shape"),
        material: integer(d.material, "material"),
        name: String(d.caption ?? d.name ?? "Terrain").slice(0, 120),
        ...(Number(d.variant) >= 0 && Number(d.variant) < 4
          ? { variant: Number(d.variant) }
          : {}),
        ...([3, 11].includes(Number(d.special)) ? { smooth: true } : {}),
        ...([23, 24].includes(Number(d.material)) &&
        typeof d.name === "string" &&
        /^Tree[A-Z]/.test(d.name)
          ? { treeGraphic: treeGraphicName(d.name) }
          : {}),
      });
    }
    return version;
  }
  async checkWorld() {
    if (JSON.stringify(await this.rpc.call("GetMapInfo")) !== this.identity)
      throw Error("Loaded fortress changed; resynchronising");
  }
  async block(x: number, y: number, z: number): Promise<Chunk> {
    return (await this.column(x, y, [z]))[0];
  }
  async items(chunks: Chunk[]): Promise<Chunk[]> {
    if (!chunks.length || !this.scenery) return [];
    const minX = Math.min(...chunks.map((c) => c.x)) / 16,
      maxX = Math.max(...chunks.map((c) => c.x)) / 16 + 1;
    const minY = Math.min(...chunks.map((c) => c.y)) / 16,
      maxY = Math.max(...chunks.map((c) => c.y)) / 16 + 1;
    const minZ = Math.min(...chunks.map((c) => c.z)),
      maxZ = Math.max(...chunks.map((c) => c.z)) + 1;
    const count = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    if (count > 27) throw Error("Item refresh exceeds nearby block limit");
    // Partial block replies contain current items even when terrain is unchanged.
    // Never use their optional tile arrays to replace the full terrain cache.
    const result = await this.rpc.call("GetBlockList", {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      blocksNeeded: count,
      forceReload: false,
    });
    if (result.mapBlocks !== undefined && !Array.isArray(result.mapBlocks))
      throw Error("Invalid item blocks");
    const records = (result.mapBlocks ?? []) as Record<string, unknown>[];
    if (records.length > count) throw Error("Unbounded item response");
    const byKey = new Map<string, Record<string, unknown>>();
    for (const raw of records) {
      const x = integer(raw.mapX, "item block X"),
        y = integer(raw.mapY, "item block Y"),
        z = integer(raw.mapZ, "item block Z");
      const k = key(x, y, z);
      if (
        x % 16 ||
        y % 16 ||
        x < minX * 16 ||
        x >= maxX * 16 ||
        y < minY * 16 ||
        y >= maxY * 16 ||
        z < minZ ||
        z >= maxZ ||
        byKey.has(k)
      )
        throw Error("Unexpected item block coordinates");
      byKey.set(k, raw);
    }
    await this.scenery!.prepareCorpses?.(
      chunks.map((c) => ({
        chunk: c,
        items: byKey.get(key(c.x, c.y, c.z))?.items,
      })),
    );
    // RFR sends the entire region's current buildings on its first partial block.
    const buildings = records.flatMap((raw) =>
      Array.isArray(raw.buildings) ? raw.buildings : [],
    );
    return chunks.map((c) =>
      this.scenery!.withItems(
        records.length ? (this.scenery!.withBuildings?.(c, buildings) ?? c) : c,
        byKey.get(key(c.x, c.y, c.z))?.items,
      ),
    );
  }
  async column(x: number, y: number, levels: number[]): Promise<Chunk[]> {
    const minZ = Math.min(...levels),
      maxZ = Math.max(...levels) + 1;
    if (
      !levels.length ||
      maxZ - minZ > 16 ||
      ![x, y, ...levels].every(Number.isInteger) ||
      x % 16 ||
      y % 16 ||
      new Set(levels).size !== levels.length
    )
      throw Error("Invalid bounded column request");
    // One native round trip for up to sixteen levels. Full tiles/designations
    // avoid plugin-global hashes; omitted all-air blocks remain explicit air.
    const result = await this.rpc.call("GetBlockList", {
      minX: x / 16,
      maxX: x / 16 + 1,
      minY: y / 16,
      maxY: y / 16 + 1,
      minZ,
      maxZ,
      blocksNeeded: maxZ - minZ,
      forceReload: true,
    });
    const blocks = result.mapBlocks;
    if (blocks !== undefined && !Array.isArray(blocks))
      throw Error("Invalid blocks response");
    const list = (blocks ?? []) as Record<string, unknown>[];
    if (list.length > maxZ - minZ) throw Error("Unbounded response");
    const byZ = new Map<number, Record<string, unknown>>();
    for (const raw of list) {
      const z = integer(raw.mapZ, "block Z");
      if (
        raw.mapX !== x ||
        raw.mapY !== y ||
        z < minZ ||
        z >= maxZ ||
        byZ.has(z)
      )
        throw Error("Unexpected map block coordinates");
      byZ.set(z, raw);
    }
    // RFR puts the entire requested column's buildings on its first block.
    const buildings = list.flatMap((raw) =>
      Array.isArray(raw.buildings) ? raw.buildings : [],
    );
    const chunks = levels.map((z) =>
      convertBlock(byZ.get(z), x, y, z, this.defs),
    );
    for (const chunk of chunks) {
      const { z } = chunk;
      const cacheKey = key(x, y, z);
      this.openTerrain.delete(cacheKey);
      this.openTerrain.set(
        cacheKey,
        Uint8Array.from(chunk.tiles, (t) =>
          byZ.has(z) && openTile(t) ? 1 : 0,
        ),
      );
      if (this.openTerrain.size > 4096)
        this.openTerrain.delete(this.openTerrain.keys().next().value!);
    }
    for (const chunk of chunks) {
      maskEnclosedWalls(chunk, (nx, ny, nz) => {
        const cx = Math.floor(nx / 16) * 16,
          cy = Math.floor(ny / 16) * 16;
        return (
          this.openTerrain.get(key(cx, cy, nz))?.[(ny - cy) * 16 + nx - cx] ===
          1
        );
      });
      await this.scenery?.decorate(chunk, { ...byZ.get(chunk.z), buildings });
    }
    return chunks;
  }
  close() {
    this.rpc.close();
  }
}
