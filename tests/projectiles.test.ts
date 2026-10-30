import { it, expect, vi } from "vitest";
import * as THREE from "three";
import { visibleProjectiles } from "../src/bridge/projectiles.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import { FortressAdapter } from "../src/bridge/adapter.js";
import { type } from "../src/bridge/protocol.js";
import {
  ProjectileModels,
  PROJECTILE_EXPIRY_MS,
} from "../src/viewer/projectiles.js";
import type { TerrainAtlas } from "../src/viewer/terrain-atlas.js";
import { parseServerMessage } from "../src/shared/validation.js";
import {
  chunkKey,
  type Chunk,
  type Projectile,
  type ServerMessage,
} from "../src/shared/model.js";

const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Floor",
  })),
});
const c = chunk(),
  chunks = new Map([[chunkKey(c), c]]);
const sprite = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 32,
  pageHeight: 32,
};
const definitions = new Map([
  ["1,0", "AMMO/ITEM_AMMO_ARROWS"],
  ["1,1", "AMMO/ITEM_AMMO_BOLTS"],
  ["2,0", "SIEGEAMMO/ITEM_SIEGEAMMO_BALLISTA"],
  ["3,-1", "BOULDER"],
  ["4,0", "WEAPON/ITEM_WEAPON_AXE_BATTLE"],
]);
const raw = (id = 1, extra = {}) => ({
  id,
  projectile: true,
  flags1: 0,
  pos: { x: 2, y: 3, z: 4 },
  type: { matType: 1, matIndex: 0 },
  subposX: 0.25,
  subposY: -0.25,
  subposZ: 0.1,
  velocityX: 1,
  velocityY: -0.5,
  velocityZ: 0.1,
  ...extra,
});
const art = { get: () => sprite, metalIds: new Set<string>() };
const convert = (items: unknown, map = chunks) =>
  visibleProjectiles(items, map, definitions, new Map(), art);
const projectile = (extra = {}): Projectile => ({
  id: 1,
  x: 2,
  y: 3,
  z: 4,
  velocity: [1, 0, 0],
  kind: "arrow",
  name: "arrow",
  size: 0.9,
  color: [150, 140, 100],
  ...extra,
});
const message = (
  tick: number,
  projectiles: Projectile[],
  session = "a",
): Extract<ServerMessage, { type: "projectiles" }> => ({
  type: "projectiles",
  session,
  tick,
  projectiles,
});
const models = () =>
  new ProjectileModels({
    texture: new THREE.Texture(),
    uv: () => [0, 0, 1, 1],
  } as unknown as TerrainAtlas);

it("decodes the pinned movement fields without requiring the ground flag", () => {
  const schema = type("RemoteFortressReader.Item");
  expect(
    Object.fromEntries(
      [
        "subposX",
        "subposY",
        "subposZ",
        "projectile",
        "velocityX",
        "velocityY",
        "velocityZ",
        "volume",
      ].map((k) => [k, schema.fields[k].id]),
    ),
  ).toEqual({
    subposX: 9,
    subposY: 10,
    subposZ: 11,
    projectile: 12,
    velocityX: 13,
    velocityY: 14,
    velocityZ: 15,
    volume: 16,
  });
  const decoded = schema.toObject(
    schema.decode(schema.encode(raw(1, { volume: 6000 })).finish()),
  );
  const [p] = convert([decoded]);
  expect(p).toMatchObject({
    x: 2.25,
    y: 2.75,
    kind: "arrow",
    velocity: [1, -0.5, expect.closeTo(0.1)],
  });
  expect(p.z).toBeCloseTo(4.1);
});
it("classifies arrows, bolts, ballista ammo, catapult stones and arbitrary thrown items", () => {
  const items = [
    [1, 0],
    [1, 1],
    [2, 0],
    [3, -1],
    [4, 0],
    [100, 0],
  ].map(([matType, matIndex], i) => raw(i, { type: { matType, matIndex } }));
  expect(convert(items).map((p) => p.kind)).toEqual([
    "arrow",
    "bolt",
    "ballista",
    "stone",
    "item",
    "item",
  ]);
  expect(convert(items)[2].size).toBeGreaterThan(convert(items)[0].size);
});
it("filters hidden/unloaded flight positions, deduplicates and ignores vehicles/ground items", () => {
  const block = chunk();
  block.tiles[3 * 16 + 2].shape = "unknown";
  expect(convert([raw()], new Map([[chunkKey(block), block]]))).toEqual([]);
  expect(
    convert([
      raw(1, { subposX: 20 }),
      raw(2, { projectile: false }),
      raw(3, { pos: { x: 32, y: 3, z: 4 } }),
    ]),
  ).toEqual([]);
  expect(convert([raw(), raw()])).toHaveLength(1);
  expect(
    convert([raw(1, { subposX: NaN, velocityX: Infinity })])[0],
  ).toMatchObject({ x: 2, velocity: [0, -0.5, 0.1] });
  expect(convert(Array.from({ length: 600 }, (_, i) => raw(i)))).toHaveLength(
    512,
  );
});
it("reads native straight ammunition, siege and thrown weapon/equipment mappings", () => {
  const mappings =
    sceneryMappings(`[AMMO_GRAPHICS:ITEM_AMMO_ARROWS][AMMO_GRAPHICS_STRAIGHT_WOOD:AMMO:0:2]
    [SIEGEAMMO_GRAPHICS:ITEM_SIEGEAMMO_BALLISTA][SIEGEAMMO_GRAPHICS_STRAIGHT_DEFAULT:AMMO:0:8]
    [WEAPON_GRAPHICS:ITEM_WEAPON_AXE_BATTLE][WEAPON_GRAPHICS_DEFAULT:WEAPONS:0:1]
    [ARMOR_GRAPHICS:EQUIPMENT:4:6:ITEM_ARMOR_BREASTPLATE]`);
  expect(mappings.map((m) => m.key)).toEqual([
    "ITEM_AMMO_ARROWS:WOOD",
    "ITEM_SIEGEAMMO_BALLISTA:DEFAULT",
    "ITEM_WEAPON_AXE_BATTLE:DEFAULT",
    "ITEM_ARMOR_BREASTPLATE",
  ]);
});
it("polls one existing block for the global snapshot without replacing cached terrain", async () => {
  const call = vi.fn().mockResolvedValue({
    mapBlocks: [{ mapX: 0, mapY: 0, mapZ: 4, items: [raw()] }],
  });
  const fake = {
    rpc: { call },
    scenery: {
      projectiles: (items: unknown, map: Map<string, Chunk>) =>
        convert(items, map),
    },
  };
  const result = await FortressAdapter.prototype.projectiles.call(
    fake as unknown as FortressAdapter,
    chunks,
  );
  expect(result).toHaveLength(1);
  expect(call).toHaveBeenCalledWith("GetBlockList", {
    minX: 0,
    maxX: 1,
    minY: 0,
    maxY: 1,
    minZ: 4,
    maxZ: 5,
    blocksNeeded: 1,
    forceReload: false,
  });
  expect(chunks.get("0,0,4")).toBe(c);
  call.mockResolvedValue({ mapBlocks: [{ mapX: 0, mapY: 0, mapZ: 4 }] });
  expect(
    await FortressAdapter.prototype.projectiles.call(
      fake as unknown as FortressAdapter,
      chunks,
    ),
  ).toEqual([]);
});
it("validates finite bounded snapshots and rejects duplicate identities", () => {
  expect(
    parseServerMessage(message(1, [projectile({ id: 2000000 })])),
  ).toBeTruthy();
  for (const bad of [
    projectile({ x: Infinity }),
    projectile({ velocity: [1, 2] }),
    projectile({ size: -1 }),
    projectile({ sprite: { ...sprite, asset: "../file" } }),
  ])
    expect(() => parseServerMessage(message(1, [bad]))).toThrow();
  expect(() =>
    parseServerMessage(message(1, [projectile(), projectile()])),
  ).toThrow();
});
it("interpolates observed positions, orients the shaft, and never extrapolates", () => {
  const m = models();
  m.snapshot(message(1, [projectile({ sprite })]), 0);
  m.frame(chunks, 0, 4, 0);
  const object = m.group.children[0];
  expect(
    new THREE.Vector3(0, 1, 0).applyQuaternion(object.quaternion).x,
  ).toBeCloseTo(1);
  m.snapshot(message(2, [projectile({ x: 6, sprite })]), 100);
  m.frame(chunks, 150, 4, 0);
  expect(object.position.x).toBeCloseTo(4.5);
  m.frame(chunks, 400, 4, 0);
  expect(object.position.x).toBeCloseTo(6.5);
  expect(m.visibleCount).toBe(1);
  m.dispose();
});
it("settles stationary samples, rejects old ticks and removes landings and stale flights", () => {
  const m = models();
  m.snapshot(message(1, [projectile()]), 0);
  m.frame(chunks, 0, 4, 0);
  m.snapshot(message(2, [projectile({ x: 6 })]), 100);
  m.frame(chunks, 110, 4, 0);
  m.snapshot(message(3, [projectile({ x: 6 })]), 120);
  m.frame(chunks, 121, 4, 0);
  expect(m.group.children[0].position.x).toBe(6.5);
  m.snapshot(message(2, [projectile()]), 130);
  m.frame(chunks, 131, 4, 0);
  expect(m.group.children[0].position.x).toBe(6.5);
  const mesh = m.group.children[0].children[0] as THREE.Mesh,
    dispose = vi.spyOn(mesh.geometry, "dispose");
  m.snapshot(message(4, []), 140);
  expect(m.group.children).toHaveLength(0);
  expect(dispose).toHaveBeenCalled();
  m.snapshot(message(5, [projectile()]), 150);
  m.frame(chunks, 151 + PROJECTILE_EXPIRY_MS, 4, 0);
  expect(m.group.children).toHaveLength(0);
  m.snapshot(message(5, [projectile()]), 1800);
  expect(m.group.children).toHaveLength(0);
  m.snapshot(message(1, [projectile()], "b"), 1900);
  expect(m.group.children).toHaveLength(1);
  m.clear();
  expect(m.group.children).toHaveLength(0);
  m.dispose();
});
it("does not draw an interpolated flight through hidden terrain or outside the cut", () => {
  const block = chunk();
  block.tiles[3 * 16 + 4].shape = "unknown";
  const map = new Map([[chunkKey(block), block]]);
  const m = models();
  m.snapshot(message(1, [projectile()]), 0);
  m.frame(map, 0, 4, 0);
  m.snapshot(message(2, [projectile({ x: 6 })]), 100);
  m.frame(map, 150, 4, 0);
  expect(m.group.children[0].position.x).toBe(6.5);
  m.frame(map, 160, 3, 0);
  expect(m.visibleCount).toBe(0);
  m.frame(new Map(), 160, 4, 0);
  expect(m.visibleCount).toBe(0);
  m.dispose();
});
