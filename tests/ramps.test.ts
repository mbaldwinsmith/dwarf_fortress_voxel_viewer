import { expect, it } from "vitest";
import { chunkKey, affected, type Chunk } from "../src/shared/model.js";
import { rampSurface, RAMP_HIGH as H } from "../src/viewer/ramps.js";
import { buildMesh } from "../src/viewer/mesh.js";
function fixture(x = 8, y = 8) {
  const chunks = new Map<string, Chunk>();
  function set(
    x: number,
    y: number,
    shape: "wall" | "ramp" | "empty" | "unknown",
  ) {
    const cx = Math.floor(x / 16) * 16,
      cy = Math.floor(y / 16) * 16,
      k = `${cx},${cy},0`;
    let c = chunks.get(k);
    if (!c) {
      c = {
        x: cx,
        y: cy,
        z: 0,
        tiles: Array.from({ length: 256 }, () => ({
          shape: "empty",
          material: 0,
          name: "Air",
        })),
      };
      chunks.set(k, c);
    }
    c.tiles[(y - cy) * 16 + x - cx] = { shape, material: 2, name: shape };
    return c;
  }
  const c = set(x, y, "ramp");
  return { chunks, set, c, surface: () => rampSurface(chunks, x, y, 0) };
}
it.each([
  [0, -1, [H, 0.12, 0.12, H]],
  [0, 1, [0.12, H, H, 0.12]],
  [-1, 0, [H, H, 0.12, 0.12]],
  [1, 0, [0.12, 0.12, H, H]],
])("rises toward a wall at (%s,%s)", (dx, dy, expected) => {
  const f = fixture();
  f.set(8 + Number(dx), 8 + Number(dy), "wall");
  expect(f.surface().corners).toEqual(expected);
  const data = buildMesh(f.c, f.chunks, 0);
  expect(data.positions.every(Number.isFinite)).toBe(true);
});
it("handles diagonal support across chunk corners and invalidates on removal", () => {
  const f = fixture(15, 15),
    neighbour = f.set(16, 16, "wall");
  expect(f.surface().corners).toEqual([0.12, 0.12, H, 0.12]);
  expect(affected(neighbour)).toContain(chunkKey(f.c));
  f.set(16, 16, "empty");
  expect(f.surface().corners).toEqual([0.12, 0.12, 0.12, 0.12]);
});
it("keeps multiple uphill exits and respects redacted support", () => {
  const f = fixture();
  f.set(8, 7, "wall");
  f.set(9, 8, "unknown");
  expect(f.surface().corners).toEqual([H, 0.12, H, H]);
});
it("preserves a diagonal-only uphill connection beside lower floors", () => {
  const f = fixture();
  f.set(9, 9, "wall");
  f.c.tiles[8 * 16 + 9] = { shape: "floor", material: 2, name: "Grass" };
  f.c.tiles[9 * 16 + 8] = { shape: "floor", material: 2, name: "Grass" };
  expect(f.surface().corners).toEqual([0.12, 0.12, H, 0.12]);
});
it("keeps opposite exits sloped rather than becoming a flat wall", () => {
  const f = fixture();
  f.set(8, 7, "wall");
  f.set(8, 9, "wall");
  expect(f.surface().corners).toEqual([H, H, H, H]);
  expect(f.surface().center).toBeLessThan(1);
});
it("uses confirmed upper landings instead of lifting the low edge against side walls", () => {
  const f = fixture();
  f.set(8, 7, "wall");
  f.set(8, 9, "wall");
  f.set(9, 8, "wall");
  const above: Chunk = {
    x: 0,
    y: 0,
    z: 1,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "wall",
      material: 2,
      name: "Rock",
    })),
  };
  above.tiles[8 * 16 + 8] = { shape: "empty", material: 0, name: "Ramp top" };
  above.tiles[8 * 16 + 9] = {
    shape: "floor",
    material: 2,
    name: "Upper landing",
  };
  f.chunks.set(chunkKey(above), above);
  expect(f.surface().corners).toEqual([0.12, 0.12, H, H]);
});
