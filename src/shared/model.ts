export interface SpriteLayer {
  eyeColor?: [number, number, number];
  sprite: SpriteRef;
  palette?: { asset: string; sourceRow: number; row: number };
  tint?: [number, number, number];
}
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
  shape: Shape;
  material: number;
  name: string;
}
export interface Chunk {
  x: number;
  y: number;
  z: number;
  tiles: Tile[];
  objects?: SceneryObject[];
}
export interface SceneryObject {
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
  | { type: "creatures"; session: string; tick: number; creatures: Creature[] }
  | { type: "status"; message: string }
  | {
      type: "reset";
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
export function affected(c: Chunk): string[] {
  return [
    ...[-16, 0, 16].flatMap((dx) =>
      [-16, 0, 16].map((dy) => key(c.x + dx, c.y + dy, c.z)),
    ),
    key(c.x, c.y, c.z - 1),
    key(c.x, c.y, c.z + 1),
  ];
}
