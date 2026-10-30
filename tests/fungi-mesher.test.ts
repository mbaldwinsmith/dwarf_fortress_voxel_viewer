import { it, expect, vi } from "vitest";
import { FungiMesher } from "../src/viewer/fungi-mesher.js";
import type { CapJob, CapResult } from "../src/viewer/fungi-worker.js";
import type { Chunk } from "../src/shared/model.js";
class WorkerStub {
  static current: WorkerStub;
  onmessage?: ({ data }: { data: CapResult }) => void;
  posts: CapJob[] = [];
  terminate = vi.fn();
  constructor() {
    WorkerStub.current = this;
  }
  postMessage(job: CapJob) {
    this.posts.push(job);
  }
  complete(job: CapJob) {
    this.onmessage?.({
      data: {
        id: job.id,
        key: job.key,
        positions: new Float32Array(),
        normals: new Float32Array(),
        caps: new Float32Array(),
        undersides: new Float32Array(),
      },
    });
  }
}
it("coalesces background cap rebuilds, discards stale results and cancels on reset/dispose", () => {
  vi.stubGlobal("Worker", WorkerStub);
  const c: Chunk = {
    x: 0,
    y: 0,
    z: 4,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "empty",
      material: 0,
      name: "Air",
    })),
  };
  c.tiles[68] = {
    shape: "wall",
    material: 24,
    name: "Cap",
    treeGraphic: "TREE_CAP_PILLAR",
  };
  const chunks = new Map([["0,0,4", c]]),
    first = vi.fn(),
    superseded = vi.fn(),
    latest = vi.fn(),
    mesher = new FungiMesher(),
    worker = WorkerStub.current;
  try {
    expect(mesher.request(c, chunks, () => [0, 0, 1, 1], false, first)).toBe(
      true,
    );
    mesher.request(c, chunks, () => [0, 0, 1, 1], false, superseded);
    mesher.request(c, chunks, () => [0, 0, 1, 1], true, latest);
    expect(worker.posts).toHaveLength(1);
    expect(mesher.pending).toBe(2);
    worker.complete(worker.posts[0]);
    expect(first).not.toHaveBeenCalled();
    expect(worker.posts).toHaveLength(2);
    expect(worker.posts[1].cutTop).toBe(true);
    worker.complete(worker.posts[1]);
    expect(latest).toHaveBeenCalledOnce();
    expect(superseded).not.toHaveBeenCalled();
    expect(mesher.pending).toBe(0);
    mesher.request(c, chunks, () => [0, 0, 1, 1], false, first);
    mesher.clear();
    worker.complete(worker.posts[2]);
    expect(first).not.toHaveBeenCalled();
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
  expect(worker.terminate).toHaveBeenCalledOnce();
});
