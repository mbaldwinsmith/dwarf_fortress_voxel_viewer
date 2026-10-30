import { chunkKey, type Chunk, type Tile } from "../shared/model.js";
import type { TreeUV } from "./tree-geometry.js";
import type { TreeJob, TreeResult } from "./tree-worker.js";
type Job = {
  request: TreeJob;
  apply: (data: TreeResult) => void;
  uv: TreeUV;
  signature: string;
  priority: number;
};
const air: Tile = { shape: "empty", material: 0, name: "Air" };
export class TreeMesher {
  private worker = new Worker(new URL("./tree-worker.ts", import.meta.url), {
    type: "module",
  });
  private queue = new Map<string, Job>();
  private versions = new Map<string, number>();
  private active?: Job;
  private serial = 0;
  private snapshots = new WeakMap<Chunk, { chunk: Chunk; signature: string }>();
  private cache = new Map<
    string,
    { signature: string; result: TreeResult; bytes: number }
  >();
  private cacheBytes = 0;
  cacheHits = 0;
  completed = 0;
  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<TreeResult>) => {
      const job = this.active;
      if (job?.request.id !== data.id) return;
      this.active = undefined;
      this.completed++;
      const rects = data.refs.map(({ ref, transparent }) =>
        job.uv(ref, transparent),
      );
      for (let i = 0; i < data.uvs.length; i += 2) {
        const slot = Math.floor(data.uvs[i] / 2),
          rect = rects[slot],
          u = data.uvs[i] - slot * 2,
          v = data.uvs[i + 1];
        data.uvs[i] = rect[0] + (rect[2] - rect[0]) * u;
        data.uvs[i + 1] = rect[1] + (rect[3] - rect[1]) * v;
      }
      const bytes =
        data.positions.byteLength +
        data.colors.byteLength +
        data.uvs.byteLength;
      this.cacheBytes -= this.cache.get(data.key)?.bytes ?? 0;
      this.cache.delete(data.key);
      this.cache.set(data.key, {
        signature: job.signature,
        result: data,
        bytes,
      });
      this.cacheBytes += bytes;
      for (const [key, value] of this.cache) {
        if (this.cacheBytes <= 32 * 1024 * 1024 && this.cache.size <= 256)
          break;
        this.cache.delete(key);
        this.cacheBytes -= value.bytes;
      }
      if (this.versions.get(data.key) === data.id) job.apply(data);
      this.pump();
    };
  }
  get pending() {
    return this.queue.size + Number(!!this.active);
  }
  private snapshot(c: Chunk) {
    let cached = this.snapshots.get(c);
    if (cached) return cached;
    const chunk: Chunk = {
      x: c.x,
      y: c.y,
      z: c.z,
      tiles: c.tiles.map((t) =>
        t?.shape !== "unknown" && t?.treeGraphic
          ? {
              shape: t.shape,
              material: t.material,
              name: t.name,
              treeGraphic: t.treeGraphic,
              tree: t.tree,
            }
          : air,
      ),
    };
    cached = { chunk, signature: JSON.stringify(chunk) };
    this.snapshots.set(c, cached);
    return cached;
  }
  request(
    c: Chunk,
    chunks: Map<string, Chunk>,
    uv: TreeUV,
    apply: (data: TreeResult) => void,
    priority = 0,
  ) {
    const key = chunkKey(c),
      id = ++this.serial;
    if (
      !c.tiles.some(
        (t) =>
          t.shape !== "unknown" && t.treeGraphic && !/CAP/.test(t.treeGraphic),
      )
    ) {
      this.versions.set(key, id);
      this.queue.delete(key);
      return false;
    }
    const near = [...chunks.values()]
        .filter((n) => Math.abs(n.x - c.x) <= 16 && Math.abs(n.y - c.y) <= 16)
        .sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
        .map((n) => this.snapshot(n)),
      signature = near.map((n) => n.signature).join("|");
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
        job.uv = uv;
        job.priority = priority;
        if (job === this.active) this.queue.delete(key);
        this.versions.set(key, job.request.id);
        return true;
      }
    this.versions.set(key, id);
    this.queue.delete(key);
    this.queue.set(key, {
      request: { id, key, chunks: near.map((n) => n.chunk) },
      apply,
      uv,
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
    this.queue.delete(next[0]);
    this.active = next[1];
    this.worker.postMessage(this.active.request);
  }
  clear() {
    this.queue.clear();
    this.versions.clear();
    this.cache.clear();
    this.cacheBytes = 0;
    this.snapshots = new WeakMap();
  }
  dispose() {
    this.clear();
    this.worker.terminate();
    this.active = undefined;
  }
}
