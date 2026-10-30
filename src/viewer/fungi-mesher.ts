import { columnsNear, core } from "./fungi-caps.js";
import type { CapJob, CapResult } from "./fungi-worker.js";
import { chunkKey, type Chunk, type SpriteRef } from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
type Job = { request: CapJob; apply: (result: CapResult) => void };
export class FungiMesher {
  private worker = new Worker(new URL("./fungi-worker.ts", import.meta.url), {
    type: "module",
  });
  private queue = new Map<string, Job>();
  private versions = new Map<string, number>();
  private active?: Job;
  private serial = 0;
  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<CapResult>) => {
      const job = this.active;
      if (job?.request.id === data.id) {
        this.active = undefined;
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
  ) {
    const key = chunkKey(c),
      columns = columnsNear(c, chunks),
      id = ++this.serial;
    this.versions.set(key, id);
    this.queue.delete(key);
    if (!columns.length) return false;
    const rects = new Map<string, TerrainUV>();
    for (const column of columns) {
      const t = column.tile.tree,
        cap = t?.capSurface ?? core(t?.cap),
        under = core(t?.bark) ?? cap;
      for (const ref of [cap, under]) rects.set(JSON.stringify(ref), uv(ref));
    }
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
    });
    this.pump();
    return true;
  }
  private pump() {
    if (this.active) return;
    const next = this.queue.entries().next().value;
    if (!next) return;
    const [key, job] = next;
    this.queue.delete(key);
    this.active = job;
    this.worker.postMessage(job.request);
  }
  clear() {
    this.queue.clear();
    this.versions.clear();
  }
  dispose() {
    this.clear();
    this.worker.terminate();
    this.active = undefined;
  }
}
