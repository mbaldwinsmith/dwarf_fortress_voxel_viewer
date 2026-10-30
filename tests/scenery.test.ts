import { it, expect, vi } from "vitest";
import * as THREE from "three";
import {
  buildingObjects,
  plantObjects,
  SceneryReader,
} from "../src/bridge/scenery.js";
import { sceneryMappings } from "../src/bridge/scenery-graphics.js";
import { objectQuad, ScenerySprites } from "../src/viewer/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
import { parseGraphics } from "../src/bridge/graphics.js";
import type { Chunk, SceneryObject, SpriteRef } from "../src/shared/model.js";
import type { Rpc } from "../src/bridge/rpc.js";
import type { SceneryGraphics } from "../src/bridge/scenery-graphics.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 32,
  pageHeight: 32,
};
const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 0,
    name: "Floor",
  })),
});
const art = { get: vi.fn((_key: string) => sprite) };
const defs = new Map([
  ["13,0,-1", "Workshop/Carpenters"],
  ["1,-1,-1", "Bed"],
  ["8,-1,-1", "Door"],
  ["29,-1,-1", "Stockpile"],
]);
const building = (changes = {}) => ({
  index: 7,
  posXMin: 14,
  posXMax: 16,
  posYMin: 1,
  posYMax: 3,
  posZMin: 4,
  posZMax: 4,
  buildingType: { buildingType: 13, buildingSubtype: 0, buildingCustom: -1 },
  ...changes,
});
it("clips workshop mosaics to the owning block and excludes unrevealed tiles", () => {
  const c = chunk();
  c.tiles[1 * 16 + 14].shape = "unknown";
  art.get.mockClear();
  const objects = buildingObjects(
    c,
    [
      building(),
      { index: 99 },
      building({ posZMax: 5 }),
      building({ posXMin: 30, posXMax: 32 }),
    ],
    defs,
    art,
  );
  expect(objects).toHaveLength(5);
  expect(objects.every((o) => o.x >= 14 && o.x < 16 && o.z === 4)).toBe(true);
  expect(art.get).toHaveBeenCalledWith("WORKSHOP_CARPENTER:3:1:3");
  expect(art.get).toHaveBeenCalledWith("WORKSHOP_CARPENTER_OVERLAY:3:1:3");
  expect(objects[0].overlay).toEqual(sprite);
  const next = chunk();
  next.x = 16;
  expect(buildingObjects(next, [building()], defs, art)).toHaveLength(3);
});
it("uses floor furniture, upright door state art and skips stockpiles", () => {
  art.get.mockClear();
  const c = chunk();
  const bed = building({
    posXMin: 1,
    posXMax: 1,
    posYMin: 1,
    posYMax: 1,
    buildingType: { buildingType: 1, buildingSubtype: -1, buildingCustom: -1 },
  });
  expect(buildingObjects(c, [bed], defs, art)[0].kind).toBe("ground");
  expect(art.get).toHaveBeenCalledWith("ITEM_BED_WOOD:1");
  const door = {
    ...bed,
    index: 8,
    buildingType: { buildingType: 8, buildingSubtype: -1, buildingCustom: -1 },
    active: 0,
  };
  expect(buildingObjects(c, [door], defs, art)[0].kind).toBe("door");
  expect(art.get).toHaveBeenCalledWith("ITEM_DOOR_WOOD_OPEN");
  buildingObjects(c, [{ ...door, active: 1 }], defs, art);
  expect(art.get).toHaveBeenCalledWith("ITEM_DOOR_WOOD_CLOSED:ALL");
  expect(
    buildingObjects(
      c,
      [
        {
          ...bed,
          buildingType: {
            buildingType: 29,
            buildingSubtype: -1,
            buildingCustom: -1,
          },
        },
      ],
      defs,
      art,
    ),
  ).toHaveLength(0);
  expect(buildingObjects(c, [], defs, art)).toEqual([]);
});
it("selects species shrubs, dead plants and saplings without exposing hidden vegetation", () => {
  const c = chunk(),
    p = { posX: 1, posY: 1, posZ: 4, index: 2 },
    plants = new Map([[2, { id: "PLUMP", name: "plump helmet" }]]);
  art.get.mockClear();
  expect(
    plantObjects(c, [p, { ...p, posZ: 5 }, { ...p, posX: 16 }], plants, art),
  ).toHaveLength(1);
  expect(art.get).toHaveBeenCalledWith("PLANT:PLUMP:SHRUB");
  c.tiles[17].name = "Dead sapling";
  plantObjects(c, [p], plants, art);
  expect(art.get).toHaveBeenCalledWith("PLANT:PLUMP:SAPLING_DEAD");
  c.tiles[17].shape = "unknown";
  expect(plantObjects(c, [p], plants, art)).toEqual([]);
  c.tiles[17].shape = "wall";
  expect(plantObjects(c, [p], plants, art)).toEqual([]);
});
it("loads native tool art and renders nest boxes and omitted furniture upright", () => {
  const mappings = sceneryMappings(
    "[TOOL_GRAPHICS:TOOLS:0:10:ITEM_TOOL_NEST_BOX]" +
      "[TOOL_GRAPHICS:TOOLS:2:11:ITEM_TOOL_HIVE]",
  );
  expect(mappings).toEqual([
    { key: "ITEM_TOOL_NEST_BOX", page: "TOOLS", x: 0, y: 10 },
    { key: "ITEM_TOOL_HIVE", page: "TOOLS", x: 2, y: 11 },
  ]);
  for (const [category, token] of [
    ["NestBox", "ITEM_TOOL_NEST_BOX"],
    ["Hive", "ITEM_TOOL_HIVE"],
    ["Armorstand", "ITEM_ARMOR_STAND_WOOD_EMPTY"],
    ["Weaponrack", "ITEM_WEAPON_RACK_WOOD_EMPTY"],
    ["Cage", "ITEM_CAGE_WOOD"],
    ["AnimalTrap", "ITEM_ANIMAL_TRAP_WOOD"],
    ["Statue", "ITEM_STATUE_ITEM"],
    ["OfferingPlace", "ITEM_TOOL_ALTAR"],
    ["DisplayFurniture", "ITEM_TOOL_PEDESTAL"],
  ]) {
    const c = chunk();
    const b = building({ posXMin: 1, posXMax: 1, posYMax: 1 });
    const objects = buildingObjects(c, [b], new Map([["13,0,-1", category]]), {
      get: (key) => (key === token ? sprite : undefined),
    });
    expect(objects).toMatchObject([{ kind: "upright", sprite }]);
    const heights = objectQuad(objects[0]).filter((_, i) => i % 3 === 1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(1);
    c.objects = objects;
    expect(() =>
      parseServerMessage({
        type: "chunks",
        session: "s",
        sequence: 1,
        pollMs: 200,
        chunks: [c],
      }),
    ).not.toThrow();
    c.tiles[17].shape = "unknown";
    expect(
      buildingObjects(c, [b], new Map([["13,0,-1", category]]), art),
    ).toEqual([]);
  }
});
it("parses tile-unit page dimensions, workshop coordinates and plant states", () => {
  const text =
    "[TILE_PAGE:SHOP][FILE:images/shop.png][TILE_DIM:32:32][PAGE_DIM:3:4][TILE_GRAPHICS:SHOP:1:2:WORKSHOP_CARPENTER:3:1:1][PLANT_GRAPHICS:PLUMP][SHRUB:SHOP:0:0][SEED:SHOP:1:0]";
  expect(parseGraphics(text).pages.get("SHOP")?.width).toBe(96);
  expect(sceneryMappings(text).map((x) => x.key)).toEqual([
    "WORKSHOP_CARPENTER:3:1:1",
    "PLANT:PLUMP:SHRUB",
  ]);
});
it("validates bounded, visible, uniquely owned scenery references", () => {
  const c = chunk();
  const o: SceneryObject = {
    id: "a",
    x: 1,
    y: 1,
    z: 4,
    name: "Bed",
    kind: "ground",
    sprite,
  };
  c.objects = [o];
  const message = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  expect(() => parseServerMessage(message())).not.toThrow();
  for (const change of [
    { x: 16 },
    { z: 5 },
    { kind: "bad" },
    { sprite: { ...sprite, asset: "../x" } },
  ]) {
    c.objects = [{ ...o, ...change } as SceneryObject];
    expect(() => parseServerMessage(message())).toThrow();
  }
  c.objects = [o, o];
  expect(() => parseServerMessage(message())).toThrow();
  c.objects = [o];
  c.tiles[17].shape = "unknown";
  expect(() => parseServerMessage(message())).toThrow();
});
it("places floor quads above terrain and door quads vertically", () => {
  const o: SceneryObject = {
    id: "x",
    x: 2,
    y: 3,
    z: 4,
    name: "Test",
    kind: "ground",
  };
  const floor = objectQuad(o);
  expect(new Set(floor.filter((_, i) => i % 3 === 1))).toEqual(
    new Set([4.135]),
  );
  const door = objectQuad({ ...o, kind: "door" });
  expect(
    Math.max(...door.filter((_, i) => i % 3 === 1)) -
      Math.min(...door.filter((_, i) => i % 3 === 1)),
  ).toBeCloseTo(1);
  expect(new Set(door.filter((_, i) => i % 3 === 2)).size).toBe(1);
  expect(
    new Set(
      objectQuad({ ...o, kind: "door" }, true).filter((_, i) => i % 3 === 0),
    ).size,
  ).toBe(1);
});
it("replaces deleted furnishings, faces plants toward the camera and disposes replaced geometry", () => {
  const view = new ScenerySprites(),
    c = chunk();
  c.objects = [
    { id: "p", x: 1, y: 1, z: 4, name: "Plant", kind: "plant" },
    { id: "b", x: 2, y: 1, z: 4, name: "Bed", kind: "ground" },
  ];
  const all = new Map([["0,0,4", c]]);
  view.update([c], all);
  const mesh = view.group.children[0].children[0] as THREE.Mesh,
    dispose = vi.spyOn(mesh.geometry, "dispose");
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.set(0.4, 0.8, 0);
  view.frame(camera, 4);
  expect(mesh.quaternion.equals(camera.quaternion)).toBe(true);
  expect(view.visibleCount).toBe(2);
  view.frame(camera, 3);
  expect(view.visibleCount).toBe(0);
  c.objects = [];
  view.update([c], all);
  expect(dispose).toHaveBeenCalledOnce();
  view.frame(camera, 4);
  expect(view.visibleCount).toBe(0);
  view.clear();
  expect(view.group.children).toHaveLength(0);
  view.dispose();
});
it("caches bounded map plant reads while keeping chunk contents authoritative", async () => {
  let plants = [{ posX: 1, posY: 1, posZ: 4, index: 2 }];
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  const call = vi.fn(async (name: string) =>
    name === "GetBuildingDefList"
      ? { buildingList: [] }
      : name === "GetPlantRaws"
        ? { plantRaws: [{ index: 2, id: "PLUMP", name: "plump" }] }
        : { plantList: plants },
  );
  const reader = new SceneryReader(
    { call } as unknown as Rpc,
    art as unknown as SceneryGraphics,
    { x: 0, y: 0, z: 0, width: 80, depth: 80, height: 10 },
  );
  await reader.initialize();
  const c = chunk();
  await reader.decorate(c);
  await reader.decorate(c);
  expect(
    call.mock.calls.filter(([name]) => name === "GetPlantList"),
  ).toHaveLength(1);
  expect(c.objects).toHaveLength(1);
  plants = [];
  clock.mockReturnValue(5001);
  await reader.decorate(c);
  expect(c.objects).toEqual([]);
  clock.mockRestore();
});
it("omits flat stair art in first person and restores it in orbit mode", () => {
  const view = new ScenerySprites(),
    c = chunk();
  c.objects = [
    { id: "s:2:1:4", x: 2, y: 1, z: 4, name: "Stairs", kind: "ground" },
  ];
  const all = new Map([["0,0,4", c]]);
  const camera = new THREE.PerspectiveCamera();
  view.update([c], all, true);
  view.frame(camera, 6);
  expect(view.visibleCount).toBe(0);
  view.update([c], all);
  view.frame(camera, 4);
  expect(view.visibleCount).toBe(1);
  view.dispose();
});
