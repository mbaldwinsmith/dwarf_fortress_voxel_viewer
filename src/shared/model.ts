export interface SpriteLayer {
  offset?: [number, number];
  eyeColor?: [number, number, number];
  sprite: SpriteRef;
  palette?: { asset: string; sourceRow: number; row: number };
  tint?: [number, number, number];
}
export const LEVELS_BELOW = 5;
export const LEVELS_ABOVE = 10;
export interface SpriteRef {
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}
export interface Creature {
  id: number;
  x: number;
  y: number;
  z: number;
  name: string;
  sprite?: SpriteRef;
  layers?: SpriteLayer[];
}
export type Shape = "empty" | "wall" | "floor" | "ramp" | "stairs" | "unknown";
export interface Tile {
  tree?: {
    species?: string;
    progress?: number;
    bark?: SpriteRef;
    side?: SpriteRef;
    leaves?: SpriteRef;
    cap?: SpriteRef;
  };
  liquid?: { kind: "water" | "magma"; depth: number; surface?: SpriteRef };
  variant?: number;
  wallCap?: SpriteRef;
  wallMask?: number;
  wallRim?: SpriteRef[];
  wallRimTint?: [number, number, number];
  sealed?: true;
  color?: [number, number, number];
  materialName?: string;
  smooth?: boolean;
  surfaces?: {
    top: SpriteRef;
    side: SpriteRef;
    topTint?: [number, number, number];
  };
  treeGraphic?: string;
  shape: Shape;
  material: number;
  name: string;
}
export interface Chunk {
  ceilingTexture?: SpriteRef;
  x: number;
  y: number;
  z: number;
  tiles: Tile[];
  objects?: SceneryObject[];
  flows?: FlowEffect[];
}
export interface FlowEffect {
  x: number;
  y: number;
  z: number;
  kind:
    | "smoke"
    | "mist"
    | "steam"
    | "fire"
    | "dragonfire"
    | "magma-mist"
    | "miasma"
    | "dust"
    | "gas"
    | "vapor"
    | "item-cloud";
  density: number;
  frames?: SpriteRef[];
}
export interface SceneryObject {
  palette?: SpriteLayer["palette"];
  tint?: [number, number, number];
  details?: {
    sprite: SpriteRef;
    tint?: [number, number, number];
    brightness?: number;
  }[];
  id: string;
  x: number;
  y: number;
  z: number;
  name: string;
  kind: "ground" | "door" | "plant";
  sprite?: SpriteRef;
  overlay?: SpriteRef;
}
export interface Bounds {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}
export type ServerMessage =
  | {
      type: "mining-assets";
      session: string;
      pick: SpriteRef;
      spade: SpriteRef;
    }
  | {
      type: "mining-result";
      session: string;
      id: number;
      ok: boolean;
      message: string;
    }
  | {
      type: "view";
      focus?: { x: number; y: number };
      session: string;
      bounds: Bounds;
      level: number;
      mode: "screen" | "map";
    }
  | { type: "creatures"; session: string; tick: number; creatures: Creature[] }
  | { type: "status"; message: string }
  | {
      type: "reset";
      focus?: { x: number; y: number };
      session: string;
      bounds: Bounds;
      world: string;
      level?: number;
      mode?: "screen" | "map";
    }
  | {
      type: "chunks";
      session: string;
      sequence: number;
      chunks: Chunk[];
      pollMs: number;
      priority?: boolean;
    };
export const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const chunkKey = (c: Chunk) => key(c.x, c.y, c.z);
export function tileAt(
  chunks: Map<string, Chunk>,
  x: number,
  y: number,
  z: number,
): Tile | undefined {
  return chunks.get(key(Math.floor(x / 16) * 16, Math.floor(y / 16) * 16, z))
    ?.tiles[(((y % 16) + 16) % 16) * 16 + (((x % 16) + 16) % 16)];
}
export class WorldState {
  session = "";
  sequence = 0;
  chunks = new Map<string, Chunk>();
  reset(session: string) {
    this.session = session;
    this.sequence = 0;
    this.chunks.clear();
  }
  merge(message: Extract<ServerMessage, { type: "chunks" }>): boolean {
    if (
      message.session !== this.session ||
      message.sequence !== this.sequence + 1
    )
      return false;
    for (const c of message.chunks) this.chunks.set(chunkKey(c), c);
    this.sequence = message.sequence;
    return true;
  }
}
// A view change keeps overlapping levels; only the departing fringe
// leaves memory. A world/session reset remains a full invalidation.
export function retainChunks(
  chunks: Map<string, Chunk>,
  bounds: Bounds,
  level: number,
) {
  for (const [k, c] of chunks) {
    if (
      c.z < Math.max(bounds.z, level - LEVELS_BELOW) ||
      c.z > Math.min(bounds.z + bounds.height - 1, level + LEVELS_ABOVE) ||
      c.x < bounds.x ||
      c.y < bounds.y ||
      c.x >= bounds.x + bounds.width ||
      c.y >= bounds.y + bounds.depth
    )
      chunks.delete(k);
  }
}
export function affected(c: Chunk): string[] {
  return [
    ...[-16, 0, 16].flatMap((dx) =>
      [-16, 0, 16].map((dy) => key(c.x + dx, c.y + dy, c.z)),
    ),
    ...[-16, 0, 16].flatMap((dx) =>
      [-16, 0, 16].map((dy) => key(c.x + dx, c.y + dy, c.z - 1)),
    ),
    key(c.x, c.y, c.z + 1),
  ];
}
