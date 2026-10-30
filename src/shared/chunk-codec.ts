import type { Chunk, ServerMessage, Tile } from "./model.js";

export type PackedChunk = Omit<Chunk, "tiles"> & {
  tilePalette: Tile[];
  tileIndices: number[];
};
// Chunks are immutable after publication. Weak keys let departed chunks and
// their packed form leave memory together; no second world-sized JSON cache.
const packed = new WeakMap<Chunk, Chunk | PackedChunk>();
function equalValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  const keys = Object.keys(aa);
  return (
    keys.length === Object.keys(bb).length &&
    keys.every((k) => Object.hasOwn(bb, k) && equalValue(aa[k], bb[k]))
  );
}
export function packChunk(chunk: Chunk, refresh = false): Chunk | PackedChunk {
  if (!refresh) {
    const previous = packed.get(chunk);
    if (previous) return previous;
  }
  const palette: Tile[] = [],
    indices: number[] = [],
    keys = new Map<string, number>();
  let last: Tile | undefined,
    lastIndex = -1;
  for (const tile of chunk.tiles) {
    // Air, walls and floors usually form long runs. Exact comparison avoids
    // serializing the same large native-art description for every cell.
    if (last && equalValue(last, tile)) {
      indices.push(lastIndex);
      continue;
    }
    const key = JSON.stringify(tile);
    let index = keys.get(key);
    if (index === undefined) {
      index = palette.length;
      keys.set(key, index);
      palette.push(tile);
    }
    indices.push(index);
    last = tile;
    lastIndex = index;
  }
  const { tiles, ...rest } = chunk;
  const result =
    palette.length < tiles.length * 0.75
      ? { ...rest, tilePalette: palette, tileIndices: indices }
      : chunk;
  packed.set(chunk, result);
  return result;
}
/** Expand only a bounded palette. The regular validator still checks every
 * distinct tile and every scenery/flow position against the expanded cells. */
export function unpackChunk(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (value.tilePalette === undefined && value.tileIndices === undefined)
    return value;
  const { tilePalette, tileIndices, ...rest } = value;
  if (
    value.tiles !== undefined ||
    !Array.isArray(tilePalette) ||
    !tilePalette.length ||
    tilePalette.length > 256 ||
    !Array.isArray(tileIndices) ||
    tileIndices.length !== 256 ||
    !tileIndices.every(
      (i) => Number.isInteger(i) && i >= 0 && i < tilePalette.length,
    )
  )
    throw Error("Invalid chunk palette");
  return { ...rest, tiles: tileIndices.map((i) => tilePalette[i]) };
}
export function wireMessage(message: ServerMessage) {
  return message.type === "chunks"
    ? { ...message, chunks: message.chunks.map((c) => packChunk(c)) }
    : message;
}
