import { it, expect } from "vitest";
import { blockOrder, parseLevel } from "../src/bridge/region.js";
import { parseServerMessage } from "../src/shared/validation.js";
const bounds = { x: 0, y: 0, z: 0, width: 192, depth: 192, height: 199 };
it("covers every XY block in three levels, top first without duplicates", () => {
  const order = blockOrder(bounds, 128);
  expect(order).toHaveLength(432);
  expect(new Set(order.map((p) => p.join(","))).size).toBe(432);
  expect(order.slice(0, 144).every((p) => p[2] === 128)).toBe(true);
  expect(order).toContainEqual([0, 0, 128]);
  expect(order).toContainEqual([176, 176, 126]);
  expect(order[0][0]).toBeGreaterThan(0);
});
it("clamps streaming depth at map bottom", () => {
  expect(blockOrder(bounds, 0)).toHaveLength(144);
  expect(blockOrder(bounds, 1)).toHaveLength(288);
});
it("accepts only bounded read-only integer level operations", () => {
  expect(parseLevel('{"type":"level","z":198}', bounds)).toBe(198);
  for (const m of [
    "bad",
    '{"type":"command","z":1}',
    '{"type":"level","z":199}',
    '{"type":"level","z":-1}',
    '{"type":"level","z":1.5}',
  ])
    expect(parseLevel(m, bounds)).toBeUndefined();
  expect(parseLevel('{"type":"level","z":1}', undefined)).toBeUndefined();
});
it("validates full map bounds and the initial cutaway", () => {
  expect(
    parseServerMessage({
      type: "reset",
      session: "s",
      world: "World",
      bounds,
      level: 128,
    }).type,
  ).toBe("reset");
  expect(() =>
    parseServerMessage({
      type: "reset",
      session: "s",
      world: "World",
      bounds,
      level: 199,
    }),
  ).toThrow();
});
