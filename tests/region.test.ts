import { it, expect } from "vitest";
import {
  blockOrder,
  parseLevel,
  parseMode,
  screenRegion,
  ScreenElevation,
} from "../src/bridge/region.js";
import { parseServerMessage } from "../src/shared/validation.js";
const bounds = { x: 0, y: 0, z: 0, width: 192, depth: 192, height: 199 };
it("allows manual viewer elevation in DF Screen mode until DF changes its own level", () => {
  const elevation = new ScreenElevation();
  expect(elevation.follow(128)).toBe(128);
  elevation.select(129);
  expect(elevation.follow(128)).toBe(129);
  expect(elevation.follow(128)).toBe(129);
  expect(elevation.follow(127)).toBe(127);
  elevation.select(130);
  elevation.reset();
  expect(elevation.follow(128)).toBe(128);
});
it("accepts only the two render modes", () => {
  expect(parseMode('{"type":"mode","mode":"screen"}')).toBe("screen");
  expect(parseMode('{"type":"mode","mode":"map"}')).toBe("map");
  for (const m of [
    "null",
    "bad",
    '{"type":"command","mode":"map"}',
    '{"type":"mode","mode":"all"}',
  ])
    expect(parseMode(m)).toBeUndefined();
});
it("aligns the DF viewport to blocks and clips at map edges", () => {
  expect(
    screenRegion(bounds, {
      viewPosX: 17,
      viewPosY: 35,
      viewSizeX: 50,
      viewSizeY: 30,
      viewPosZ: 128,
    }),
  ).toEqual({
    bounds: { ...bounds, x: 16, y: 32, width: 64, depth: 48 },
    level: 128,
  });
  expect(
    screenRegion(bounds, {
      viewPosX: 185,
      viewPosY: 185,
      viewSizeX: 50,
      viewSizeY: 30,
      viewPosZ: 128,
    }).bounds,
  ).toEqual({ ...bounds, x: 176, y: 176, width: 16, depth: 16 });
  expect(() =>
    screenRegion(bounds, {
      viewPosX: 0,
      viewPosY: 0,
      viewSizeX: 0,
      viewSizeY: 30,
      viewPosZ: 128,
    }),
  ).toThrow();
});
it("covers the selected level plus ten above and five below across the full footprint", () => {
  const order = blockOrder(bounds, 128);
  expect(order).toHaveLength(2304);
  expect(new Set(order.map((p) => p.join(","))).size).toBe(2304);
  expect(order[0][2]).toBe(128);
  expect(order[1]).toEqual([order[0][0], order[0][1], 129]);
  expect(order).toContainEqual([0, 0, 128]);
  expect(order).toContainEqual([176, 176, 123]);
  expect(order).toContainEqual([176, 176, 138]);
  expect(order.some((p) => p[2] < 123 || p[2] > 138)).toBe(false);
  expect(order[0][0]).toBeGreaterThan(0);
});
it("clamps streaming depth at map bottom", () => {
  expect(blockOrder(bounds, 0)).toHaveLength(1584);
  expect(blockOrder(bounds, 1)).toHaveLength(1728);
  expect(blockOrder(bounds, 198)).toHaveLength(864);
  expect(blockOrder(bounds, 198).every((p) => p[2] < 199)).toBe(true);
});
it("prioritizes the walking camera and both overhead levels within the resident limit", () => {
  const order = blockOrder(bounds, 128, { x: 36, y: 137 });
  expect(order.slice(0, 3)).toEqual([
    [32, 128, 128],
    [32, 128, 129],
    [32, 128, 127],
  ]);
  expect(order.slice(3, 5)).toEqual([
    [32, 128, 130],
    [32, 128, 126],
  ]);
  expect(() => blockOrder({ ...bounds, width: 512, depth: 512 }, 128)).toThrow(
    /resident limit/,
  );
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
