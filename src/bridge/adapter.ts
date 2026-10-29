import type { Bounds, Chunk, Shape, Tile } from "../shared/model.js";
import { Rpc } from "./rpc.js";
import type { SceneryReader } from "./scenery.js";
import { maskEnclosedWalls, openTile } from "./wall-visibility.js";
import { key } from "../shared/model.js";
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
  if (
    raw &&
    (!Array.isArray(tiles) ||
      tiles.length !== 256 ||
      !Array.isArray(hidden) ||
      hidden.length !== 256)
  )
    throw Error("Incomplete terrain/visibility response");
  return {
    x,
    y,
    z,
    tiles: Array.from({ length: 256 }, (_, i): Tile => {
      if (!raw) return { shape: "empty", material: 0, name: "Open space" };
      if ((hidden as unknown[])[i] !== false)
        return { shape: "unknown", material: 0, name: "Undiscovered" };
      const d = defs.get(integer((tiles as unknown[])[i], "tile id"));
      if (!d) throw Error("Unknown DF tile type");
      return {
        shape: shapeFromDf(d.shape),
        material: d.material,
        name: d.name,
        ...(d.variant !== undefined ? { variant: d.variant } : {}),
        ...(d.smooth ? { smooth: true } : {}),
        ...(d.treeGraphic ? { treeGraphic: d.treeGraphic } : {}),
      };
    }),
  };
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
    // One block, force_reload: full tiles AND designations, avoiding plugin-global
    // hashes and stale all-air blocks. We do not call ResetMapHashes.
    const result = await this.rpc.call("GetBlockList", {
      minX: x / 16,
      maxX: x / 16 + 1,
      minY: y / 16,
      maxY: y / 16 + 1,
      minZ: z,
      maxZ: z + 1,
      blocksNeeded: 1,
      forceReload: true,
    });
    const blocks = result.mapBlocks;
    if (blocks !== undefined && !Array.isArray(blocks))
      throw Error("Invalid blocks response");
    const list = (blocks ?? []) as Record<string, unknown>[];
    if (list.length > 1) throw Error("Unbounded response");
    const chunk = convertBlock(list[0], x, y, z, this.defs);
    const cacheKey = key(x, y, z);
    this.openTerrain.delete(cacheKey);
    this.openTerrain.set(
      cacheKey,
      Uint8Array.from(chunk.tiles, (t) => (list[0] && openTile(t) ? 1 : 0)),
    );
    if (this.openTerrain.size > 4096)
      this.openTerrain.delete(this.openTerrain.keys().next().value!);
    maskEnclosedWalls(chunk, (nx, ny, nz) => {
      const cx = Math.floor(nx / 16) * 16,
        cy = Math.floor(ny / 16) * 16;
      return (
        this.openTerrain.get(key(cx, cy, nz))?.[(ny - cy) * 16 + nx - cx] === 1
      );
    });
    await this.scenery?.decorate(chunk, list[0]);
    return chunk;
  }
  close() {
    this.rpc.close();
  }
}
