import { columnsNear, core } from "./fungi-caps.js";
import type { CapJob, CapResult } from "./fungi-worker.js";
import { chunkKey, type Chunk, type SpriteRef } from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
type Job = {
  request: CapJob;
  apply: (result: CapResult) => void;
  signature: string;
  priority: number;
};
export class FungiMesher {
  private worker = new Worker(new URL("./fungi-worker.ts", import.meta.url), {
    type: "module",
  });
  private queue = new Map<string, Job>();
  private versions = new Map<string, number>();
  private active?: Job;
  private serial = 0;
  private cache = new Map<
    string,
    { signature: string; result: CapResult; bytes: number }
  >();
  private cacheBytes = 0;
  cacheHits = 0;
  completed = 0;
  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<CapResult>) => {
      const job = this.active;
      if (job?.request.id === data.id) {
        this.active = undefined;
        this.completed++;
        if (this.versions.get(data.key) !== data.id) {
          this.pump();
          return;
        }
        const bytes =
          data.positions.byteLength +
          data.normals.byteLength +
          data.caps.byteLength +
          data.undersides.byteLength +
          (data.indices?.byteLength ?? 0);
        const old = this.cache.get(data.key);
        this.cacheBytes -= old?.bytes ?? 0;
        this.cache.delete(data.key);
        this.cache.set(data.key, {
          signature: job.signature,
          result: data,
          bytes,
        });
        this.cacheBytes += bytes;
        for (const [key, entry] of this.cache) {
          if (this.cacheBytes <= 32 * 1024 * 1024 && this.cache.size <= 256)
            break;
          this.cache.delete(key);
          this.cacheBytes -= entry.bytes;
        }
        if (this.versions.get(data.key) === data.id) job.apply(data);
        this.pump();
      }
    };
  }
  get pending() {
    return this.queue.size + Number(!!this.active);
  }
  request(
    c: Chunk,
    chunks: Map<string, Chunk>,
    uv: (ref?: SpriteRef) => TerrainUV,
    cutTop: boolean,
    apply: (data: CapResult) => void,
    priority = 0,
  ) {
    const key = chunkKey(c),
      columns = columnsNear(c, chunks),
      id = ++this.serial;
    if (!columns.length) {
      this.versions.set(key, id);
      this.queue.delete(key);
      return false;
    }
    const rects = new Map<string, TerrainUV>();
    for (const column of columns) {
      const t = column.tile.tree,
        cap = t?.capSurface ?? core(t?.cap),
        under = core(t?.bark) ?? cap;
      for (const ref of [cap, under]) rects.set(JSON.stringify(ref), uv(ref));
    }
    const signature = JSON.stringify([
      cutTop,
      columns.map((col) => ({
        x: col.x,
        y: col.y,
        bottom: col.bottom,
        top: col.top,
        cap: col.tile.tree?.capSurface ?? core(col.tile.tree?.cap),
        bark: core(col.tile.tree?.bark),
      })),
      [...rects],
    ]);
    const cached = this.cache.get(key);
    if (cached?.signature === signature) {
      this.cacheHits++;
      this.versions.set(key, id);
      this.queue.delete(key);
      this.cache.delete(key);
      this.cache.set(key, cached);
      queueMicrotask(() => {
        if (this.versions.get(key) === id) apply(cached.result);
      });
      return true;
    }
    for (const job of [this.active, this.queue.get(key)])
      if (job?.request.key === key && job.signature === signature) {
        job.apply = apply;
        job.priority = priority;
        if (job === this.active) this.queue.delete(key);
        this.versions.set(key, job.request.id);
        return true;
      }
    this.versions.set(key, id);
    this.queue.delete(key);
    this.queue.set(key, {
      request: {
        id,
        key,
        c: { x: c.x, y: c.y, z: c.z },
        columns,
        rects: [...rects],
        cutTop,
      },
      apply,
      signature,
      priority,
    });
    this.pump();
    return true;
  }
  private pump() {
    if (this.active) return;
    const next = [...this.queue.entries()].sort(
      (a, b) => a[1].priority - b[1].priority,
    )[0];
    if (!next) return;
    const [key, job] = next;
    this.queue.delete(key);
    this.active = job;
    this.worker.postMessage(job.request);
  }
  clear() {
    this.queue.clear();
    this.versions.clear();
    this.cache.clear();
    this.cacheBytes = 0;
  }
  dispose() {
    this.clear();
    this.worker.terminate();
    this.active = undefined;
  }
}
