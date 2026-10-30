import { expect, it } from "vitest";
import {
  WorldState,
  retainChunks,
  chunkKey,
  type Chunk,
} from "../src/shared/model.js";
import { parseServerMessage } from "../src/shared/validation.js";
const bounds = { x: 0, y: 0, z: 0, width: 32, depth: 32, height: 20 };
it("keeps overlapping terrain and sequence continuity through a view change", () => {
  const state = new WorldState();
  state.reset("world-a");
  const chunks: Chunk[] = [3, 4, 5, 6, 7].map((z) => ({
    x: 0,
    y: 0,
    z,
    tiles: [],
  }));
  state.merge({
    type: "chunks",
    session: state.session,
    sequence: 1,
    pollMs: 1,
    chunks,
  });
  const view = parseServerMessage({
    type: "view",
    session: state.session,
    bounds,
    level: 6,
    mode: "map",
  });
  expect(view.type).toBe("view");
  retainChunks(state.chunks, bounds, 6);
  expect(state.chunks.size).toBe(4);
  expect(state.chunks.get(chunkKey(chunks[2]))).toBe(chunks[2]);
  expect(
    state.merge({
      type: "chunks",
      session: state.session,
      sequence: 2,
      pollMs: 1,
      chunks: [],
    }),
  ).toBe(true);
  state.reset("world-b");
  expect(state.chunks.size).toBe(0);
});
it("evicts out-of-region columns and rejects malformed incremental views", () => {
  const chunks = new Map<string, Chunk>(
    [0, 16, 32].map((x) => [`${x},0,5`, { x, y: 0, z: 5, tiles: [] }]),
  );
  retainChunks(chunks, bounds, 5);
  expect([...chunks.keys()]).toEqual(["0,0,5", "16,0,5"]);
  for (const extra of [
    { level: undefined },
    { level: 20 },
    { mode: "other" },
  ]) {
    expect(() =>
      parseServerMessage({
        type: "view",
        session: "a",
        bounds,
        level: 5,
        mode: "map",
        ...extra,
      }),
    ).toThrow();
  }
});
