import { it, expect, vi } from "vitest";
import { TreeMesher } from "../src/viewer/tree-mesher.js";
import type { TreeJob, TreeResult } from "../src/viewer/tree-worker.js";
import type { Chunk } from "../src/shared/model.js";
class WorkerStub {
  static current: WorkerStub;
  onmessage?: ({ data }: { data: TreeResult }) => void;
  posts: TreeJob[] = [];
  terminate = vi.fn();
  constructor() {
    WorkerStub.current = this;
  }
  postMessage(job: TreeJob) {
    this.posts.push(job);
  }
  complete(job: TreeJob, uvs: number[] = []) {
    this.onmessage?.({
      data: {
        id: job.id,
        key: job.key,
        positions: new Float32Array(),
        colors: new Float32Array(),
        uvs: new Float32Array(uvs),
        refs: [{ transparent: false }, { transparent: true }],
      },
    });
  }
}
const block = (x = 0): Chunk => {
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
    material: 23,
    name: "Tree",
    treeGraphic: "TREE_TRUNK_PILLAR",
    tree: { species: "oak" },
  };
  return c;
};
it("coalesces tree requests, maps worker-local UVs into the atlas once and reuses completed geometry", async () => {
  vi.stubGlobal("Worker", WorkerStub);
  const mesher = new TreeMesher(),
    worker = WorkerStub.current,
    c = block(),
    chunks = new Map([["0,0,4", c]]),
    old = vi.fn(),
    latest = vi.fn();
  const uv = vi.fn((_ref, transparent) =>
    transparent
      ? ([0.5, 0.6, 0.7, 0.8] as [number, number, number, number])
      : ([0.1, 0.2, 0.3, 0.4] as [number, number, number, number]),
  );
  try {
    for (let i = 0; i < 20; i++)
      mesher.request(c, chunks, uv, i === 19 ? latest : old);
    expect(worker.posts).toHaveLength(1);
    expect(mesher.pending).toBe(1);
    worker.complete(worker.posts[0], [0.5, 0.5, 2.25, 0.75]);
    expect(old).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    const result = latest.mock.calls[0][0] as TreeResult;
    expect(result.uvs[0]).toBeCloseTo(0.2);
    expect(result.uvs[1]).toBeCloseTo(0.3);
    expect(result.uvs[2]).toBeCloseTo(0.55);
    expect(result.uvs[3]).toBeCloseTo(0.75);
    const cached = vi.fn();
    mesher.request(c, chunks, uv, cached);
    await Promise.resolve();
    expect(worker.posts).toHaveLength(1);
    expect(cached.mock.calls[0][0]).toBe(result);
    expect(uv).toHaveBeenCalledTimes(2);
    mesher.request(c, chunks, uv, old);
    mesher.clear();
    await Promise.resolve();
    expect(old).not.toHaveBeenCalled();
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("discards superseded/removed trees and redacts unknown neighbours before worker transfer", () => {
  vi.stubGlobal("Worker", WorkerStub);
  const mesher = new TreeMesher(),
    worker = WorkerStub.current,
    c = block(),
    hidden = block(16);
  hidden.tiles[68] = { ...hidden.tiles[68], shape: "unknown" };
  const chunks = new Map([
      ["0,0,4", c],
      ["16,0,4", hidden],
    ]),
    old = vi.fn(),
    latest = vi.fn(),
    uv = () => [0, 0, 1, 1] as [number, number, number, number];
  try {
    mesher.request(c, chunks, uv, old);
    expect(
      worker.posts[0].chunks[1].tiles.every((t) => !t.treeGraphic && !t.tree),
    ).toBe(true);
    const changed = structuredClone(c);
    changed.tiles[68].tree!.species = "pine";
    chunks.set("0,0,4", changed);
    mesher.request(changed, chunks, uv, latest);
    worker.complete(worker.posts[0]);
    expect(old).not.toHaveBeenCalled();
    expect(worker.posts).toHaveLength(2);
    worker.complete(worker.posts[1]);
    expect(latest).toHaveBeenCalledOnce();
    const removed = structuredClone(c);
    removed.tiles[68] = { shape: "empty", material: 0, name: "Air" };
    chunks.set("0,0,4", c);
    mesher.request(c, chunks, uv, old);
    expect(
      mesher.request(removed, new Map([["0,0,4", removed]]), uv, old),
    ).toBe(false);
    worker.complete(worker.posts[2]);
    expect(old).not.toHaveBeenCalled();
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
});
it("prioritises nearby tree work and cancels queued work on reset", () => {
  vi.stubGlobal("Worker", WorkerStub);
  const mesher = new TreeMesher(),
    worker = WorkerStub.current,
    blocks = [block(0), block(16), block(32)],
    chunks = new Map(blocks.map((c) => [`${c.x},0,4`, c])),
    uv = () => [0, 0, 1, 1] as [number, number, number, number],
    apply = vi.fn();
  try {
    mesher.request(blocks[0], chunks, uv, apply, 20);
    mesher.request(blocks[2], chunks, uv, apply, 100);
    mesher.request(blocks[1], chunks, uv, apply, 1);
    worker.complete(worker.posts[0]);
    expect(worker.posts[1].key).toBe("16,0,4");
    mesher.clear();
    worker.complete(worker.posts[1]);
    expect(worker.posts).toHaveLength(2);
    expect(apply).toHaveBeenCalledOnce();
    expect(mesher.pending).toBe(0);
  } finally {
    mesher.dispose();
    vi.unstubAllGlobals();
  }
});
