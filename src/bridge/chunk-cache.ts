import {
  chunkKey,
  retainChunks,
  type Bounds,
  type Chunk,
} from "../shared/model.js";

// Visible chunks plus a bounded LRU reserve for recently departed z-levels.
// A world/session change must clear both maps.
export class ChunkCache {
  readonly active = new Map<string, Chunk>();
  private entries = new Map<
    string,
    { chunk: Chunk; signature: string; readAt: number }
  >();
  constructor(private capacity = 4096) {}
  clear() {
    this.active.clear();
    this.entries.clear();
  }
  select(bounds: Bounds, level: number) {
    retainChunks(this.active, bounds, level);
  }
  restore(k: string): Chunk | undefined {
    const entry = this.entries.get(k);
    if (!entry) return;
    this.entries.delete(k);
    this.entries.set(k, entry);
    this.active.set(k, entry.chunk);
    return entry.chunk;
  }
  fresh(k: string, now: number, maxAge = 2000) {
    const entry = this.entries.get(k);
    return !!entry && now - entry.readAt < maxAge;
  }
  store(chunk: Chunk, now: number): boolean {
    const k = chunkKey(chunk),
      signature = JSON.stringify(chunk),
      old = this.entries.get(k);
    const changed = old?.signature !== signature || !this.active.has(k);
    const value = old?.signature === signature ? old.chunk : chunk;
    this.entries.delete(k);
    this.entries.set(k, { chunk: value, signature, readAt: now });
    this.active.set(k, value);
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.capacity) break;
      if (!this.active.has(key)) this.entries.delete(key);
    }
    return changed;
  }
  updateItems(chunk: Chunk): boolean {
    const k = chunkKey(chunk),
      entry = this.entries.get(k);
    if (!entry || !this.active.has(k)) return false;
    // Item polls must not postpone refreshes of the underlying terrain.
    return this.store(chunk, entry.readAt);
  }
}
