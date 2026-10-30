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
it("deduplicates identical pending requests and serves completed caps from cache", async () => {
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
    mesher = new FungiMesher(),
    worker = WorkerStub.current,
    old = vi.fn(),
    latest = vi.fn();
  try {
    for (let i = 0; i < 20; i++)
      mesher.request(
        c,
        chunks,
        () => [0, 0, 1, 1],
        false,
        i === 19 ? latest : old,
      );
    expect(worker.posts).toHaveLength(1);
    expect(mesher.pending).toBe(1);
    worker.complete(worker.posts[0]);
    expect(latest).toHaveBeenCalledOnce();
    expect(old).not.toHaveBeenCalled();
    const cached = vi.fn();
    mesher.request(c, chunks, () => [0, 0, 1, 1], false, cached);
    await Promise.resolve();
    expect(cached).toHaveBeenCalledOnce();
    expect(worker.posts).toHaveLength(1);
    expect(mesher.cacheHits).toBe(1);
    const cancelled = vi.fn();
    mesher.request(c, chunks, () => [0, 0, 1, 1], false, cancelled);
    mesher.clear();
    await Promise.resolve();
    expect(cancelled).not.toHaveBeenCalled();
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
});
it("prioritises nearby queued caps over distant ones", () => {
  vi.stubGlobal("Worker", WorkerStub);
  const blocks = [0, 16, 32].map((x) => {
    const c: Chunk = {
      x,
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
    return c;
  });
  const chunks = new Map(blocks.map((c) => [`${c.x},0,4`, c])),
    mesher = new FungiMesher(),
    worker = WorkerStub.current;
  try {
    mesher.request(blocks[0], chunks, () => [0, 0, 1, 1], false, vi.fn(), 100);
    mesher.request(blocks[2], chunks, () => [0, 0, 1, 1], false, vi.fn(), 80);
    mesher.request(blocks[1], chunks, () => [0, 0, 1, 1], false, vi.fn(), 1);
    worker.complete(worker.posts[0]);
    expect(worker.posts[1].key).toBe("16,0,4");
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
});
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
