import { describe, it, expect } from "vitest";
import { Frames, frame } from "../src/bridge/framing.js";
import {
  WorldState,
  affected,
  tileAt,
  chunkKey,
  type Chunk,
  type Tile,
} from "../src/shared/model.js";
import { buildMesh } from "../src/viewer/mesh.js";
import { convertBlock } from "../src/bridge/adapter.js";
const air: Tile = { shape: "empty", material: 0, name: "Air" };
function chunk(x = 0, y = 0, z = 0): Chunk {
  return { x, y, z, tiles: Array.from({ length: 256 }, () => ({ ...air })) };
}
describe("DFHack native framing", () => {
  it("handles every fragmentation point and combined frames", () => {
    const wire = Buffer.concat([
      frame(-3, Buffer.from("text")),
      frame(-1, Buffer.from("result")),
    ]);
    for (let i = 0; i <= wire.length; i++) {
      const parser = new Frames();
      const replies = [
        ...parser.push(wire.subarray(0, i)),
        ...parser.push(wire.subarray(i)),
      ];
      expect(replies.map((r) => r.body.toString())).toEqual(["text", "result"]);
    }
  });
  it("treats FAIL size as error code, with no body", () => {
    const h = Buffer.alloc(8);
    h.writeInt16LE(-2);
    h.writeInt32LE(-1, 4);
    expect(new Frames().push(h)[0].code).toBe(-1);
  });
  it("rejects oversized and negative payloads", () => {
    for (const size of [-1, 67108865]) {
      const h = frame(-1);
      h.writeInt32LE(size, 4);
      expect(() => new Frames().push(h)).toThrow();
    }
  });
});
describe("world state and coordinates", () => {
  it("resets sessions and rejects gaps and stale updates", () => {
    const s = new WorldState();
    s.reset("a");
    expect(
      s.merge({
        type: "chunks",
        session: "a",
        sequence: 1,
        chunks: [chunk()],
        pollMs: 1,
      }),
    ).toBe(true);
    expect(
      s.merge({
        type: "chunks",
        session: "a",
        sequence: 3,
        chunks: [],
        pollMs: 1,
      }),
    ).toBe(false);
    s.reset("b");
    expect(s.chunks.size).toBe(0);
    expect(
      s.merge({
        type: "chunks",
        session: "a",
        sequence: 2,
        chunks: [chunk()],
        pollMs: 1,
      }),
    ).toBe(false);
  });
  it("looks up row-major tiles across negative block boundaries", () => {
    const c = chunk(-16, 16, 4);
    c.tiles[31] = { shape: "floor", material: 2, name: "Stone" };
    expect(tileAt(new Map([[chunkKey(c), c]]), -1, 17, 4)?.name).toBe("Stone");
    expect(affected(c)).toContain("0,16,4");
    expect(affected(c)).toHaveLength(7);
  });
});
describe("terrain meshing", () => {
  it("emits exposed faces, including across chunk boundaries", () => {
    const a = chunk(),
      b = chunk(16);
    a.tiles[15] = { shape: "wall", material: 2, name: "Stone" };
    b.tiles[0] = { shape: "wall", material: 2, name: "Stone" };
    const map = new Map([
      [chunkKey(a), a],
      [chunkKey(b), b],
    ]);
    expect(buildMesh(a, map, 0).positions.length).toBe(5 * 18);
    b.tiles[0] = air;
    expect(buildMesh(a, map, 0).positions.length).toBe(6 * 18);
  });
  it("caps cutaways with solid top faces", () => {
    const a = chunk(),
      above = chunk(0, 0, 1);
    a.tiles[0] = above.tiles[0] = { shape: "wall", material: 2, name: "Stone" };
    const map = new Map([
      [chunkKey(a), a],
      [chunkKey(above), above],
    ]);
    expect(buildMesh(above, map, 0).positions).toHaveLength(0);
    expect(
      buildMesh(a, map, 0).positions.length -
        buildMesh(a, map, 1).positions.length,
    ).toBe(18);
  });
});
describe("untrusted RFR terrain boundary", () => {
  const defs = new Map([[1, { shape: 4, material: 2, name: "Granite" }]]);
  it("redacts hidden terrain before sending to browser", () => {
    const c = convertBlock(
      {
        mapX: 0,
        mapY: 0,
        mapZ: 0,
        tiles: Array(256).fill(1),
        hidden: Array(256).fill(true),
      },
      0,
      0,
      0,
      defs,
    );
    expect(c.tiles[0]).toEqual({
      shape: "unknown",
      material: 0,
      name: "Undiscovered",
    });
  });
  it("rejects missing visibility and wrong coordinates", () => {
    expect(() =>
      convertBlock(
        { mapX: 0, mapY: 0, mapZ: 0, tiles: Array(256).fill(1) },
        0,
        0,
        0,
        defs,
      ),
    ).toThrow();
    expect(() => convertBlock({ mapX: 16 }, 0, 0, 0, defs)).toThrow();
  });
  it("replaces missing all-air blocks with empty terrain", () => {
    expect(
      convertBlock(undefined, 0, 0, 0, defs).tiles.every(
        (t) => t.shape === "empty",
      ),
    ).toBe(true);
  });
});
