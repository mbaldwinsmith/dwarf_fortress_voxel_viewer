import { it, expect, vi } from "vitest";
import * as THREE from "three";
import { displayItemLayers } from "../src/bridge/ground-items.js";
import { parseDisplayItems } from "../src/bridge/display-items.js";
import { buildingObjects, SceneryReader } from "../src/bridge/scenery.js";
import type { Rpc } from "../src/bridge/rpc.js";
import type { SceneryGraphics } from "../src/bridge/scenery-graphics.js";
import { ScenerySprites } from "../src/viewer/scenery.js";
import { parseServerMessage } from "../src/shared/validation.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const base: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 256,
  pageHeight: 256,
};
const figure = { ...base, x: 64 },
  crown = { ...base, x: 96 },
  caseArt = { ...base, x: 32 };
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
const b = {
  index: 7,
  posXMin: 2,
  posXMax: 2,
  posYMin: 3,
  posYMax: 3,
  posZMax: 4,
  buildingType: { buildingType: 1, buildingSubtype: -1, buildingCustom: -1 },
  items: [
    { mode: 2, item: { id: 10, type: { matType: 86, matIndex: 3 } } },
    { mode: 0, item: { id: 11, type: { matType: 79, matIndex: -1 } } },
  ],
};
const art = {
  get: (key: string) =>
    ({
      ITEM_TOOL_DISPLAY_CASE: caseArt,
      ITEM_TOOL_PEDESTAL: base,
      "ITEM_STATUE_WOOD:1": base,
      ITEM_STATUE: figure,
      ITEM_CROWN_WOOD: crown,
    })[key],
};
const defs = new Map([
  ["86,3", "TOOL/ITEM_TOOL_DISPLAY_CASE"],
  ["79,-1", "CROWN"],
]);
it("accepts only requested, unique, bounded display IDs", () => {
  expect(
    parseDisplayItems('DEEPWATCH_DISPLAYS:[{"id":7,"items":[11]}]', [7]),
  ).toEqual([{ id: 7, items: [11] }]);
  expect(
    parseDisplayItems('DEEPWATCH_DISPLAYS:[{"id":7,"items":{}}]', [7]),
  ).toEqual([{ id: 7, items: [] }]);
  for (const data of [
    [{ id: 8, items: [] }],
    [{ id: 7, items: [11, 11] }],
    [{ id: 7, items: [-1] }],
    [{ id: 7, items: Array.from({ length: 9 }, (_, i) => i) }],
    [
      { id: 7, items: [] },
      { id: 7, items: [] },
    ],
  ])
    expect(() =>
      parseDisplayItems("DEEPWATCH_DISPLAYS:" + JSON.stringify(data), [7]),
    ).toThrow();
});
it("distinguishes cases and renders only a confirmed, physically contained displayed item", () => {
  const c = chunk(),
    buildings = new Map([["1,-1,-1", "DisplayFurniture"]]);
  const read = (ids: number[]) =>
    buildingObjects(
      c,
      [b],
      buildings,
      art,
      new Map(),
      new Map([[7, { items: ids }]]),
      defs,
    )[0];
  expect(read([11])).toMatchObject({
    sprite: caseArt,
    furniture: { type: "displaycase", display: [{ sprite: crown }] },
  });
  expect(read([]).furniture?.display).toBeUndefined();
  expect(read([12]).furniture?.display).toBeUndefined();
  c.tiles[50].shape = "unknown";
  expect(
    buildingObjects(
      c,
      [b],
      buildings,
      art,
      new Map(),
      new Map([[7, { items: [11] }]]),
      defs,
    ),
  ).toEqual([]);
});
it("uses the native generic statue figure separately from its pedestal", () => {
  const o = buildingObjects(
    chunk(),
    [b],
    new Map([["1,-1,-1", "Statue"]]),
    art,
  )[0];
  expect(o).toMatchObject({
    sprite: base,
    furniture: { type: "statue", statue: { ...figure, height: 27 } },
  });
});
it("validates display layers, and rejects contents on unrelated furniture", () => {
  const c = chunk();
  c.objects = buildingObjects(
    c,
    [b],
    new Map([["1,-1,-1", "DisplayFurniture"]]),
    art,
    new Map(),
    new Map([[7, { items: [11] }]]),
    defs,
  );
  const message = () => ({
    type: "chunks",
    session: "s",
    sequence: 1,
    pollMs: 200,
    chunks: [c],
  });
  expect(() => parseServerMessage(message())).not.toThrow();
  c.objects[0].furniture!.display!.push({ sprite: crown });
  expect(() => parseServerMessage(message())).toThrow();
  c.objects[0].furniture!.display!.pop();
  c.objects[0].furniture!.type = "table";
  expect(() => parseServerMessage(message())).toThrow();
});
it("keeps furniture billboards vertical while tracking the camera and disposes replacements", () => {
  const load = vi
    .spyOn(THREE.TextureLoader.prototype, "load")
    .mockReturnValue(new THREE.Texture());
  const view = new ScenerySprites(),
    c = chunk();
  c.objects = buildingObjects(c, [b], new Map([["1,-1,-1", "Statue"]]), art);
  try {
    view.update([c], new Map([["0,0,4", c]]));
    const mesh = view.group.children[0].children.find(
      (m) => m.userData.furniture,
    ) as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, "dispose");
    mesh.userData.anchored = true;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(8, 9, 3.5);
    camera.lookAt(2.5, 4.4, 3.5);
    view.frame(camera, 4);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion),
      normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    expect(up.y).toBeCloseTo(1);
    expect(normal.x).toBeCloseTo(1);
    expect(mesh.position.y).toBeCloseTo(4.32);
    c.objects = [];
    view.update([c], new Map([["0,0,4", c]]));
    expect(dispose).toHaveBeenCalledOnce();
  } finally {
    view.dispose();
    load.mockRestore();
  }
});

it("bounds and caches read-only lookups to revealed display furniture", async () => {
  const lookup = vi.fn(async (ids: number[]) =>
    ids.map((id) => ({ id, items: [11] })),
  );
  const rpc = {
    call: vi.fn(async (name: string) =>
      name === "GetBuildingDefList"
        ? {
            buildingList: [
              { buildingType: b.buildingType, id: "DisplayFurniture" },
            ],
          }
        : {},
    ),
    displayItems: lookup,
  } as unknown as Rpc;
  const reader = new SceneryReader(rpc, art as SceneryGraphics, {
    x: 0,
    y: 0,
    z: 0,
    width: 16,
    depth: 16,
    height: 16,
  });
  await reader.initialize();
  const c = chunk(),
    now = vi.spyOn(performance, "now").mockReturnValue(100);
  try {
    c.tiles[50].shape = "unknown";
    await reader.prepareDisplays([c], [b]);
    expect(lookup).not.toHaveBeenCalled();
    c.tiles[50].shape = "floor";
    await reader.prepareDisplays([c], [b]);
    expect(lookup).toHaveBeenLastCalledWith([7]);
    await reader.prepareDisplays([c], [b]);
    expect(lookup).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1200);
    await reader.prepareDisplays([c], [b]);
    expect(lookup).toHaveBeenCalledTimes(2);
    lookup.mockClear();
    await reader.prepareDisplays(
      [c],
      Array.from({ length: 70 }, (_, i) => ({ ...b, index: 100 + i })),
    );
    expect(lookup.mock.calls[0][0]).toHaveLength(64);
  } finally {
    now.mockRestore();
  }
});

it("draws transparent display panes without discarding their reduced alpha", () => {
  const load = vi
      .spyOn(THREE.TextureLoader.prototype, "load")
      .mockReturnValue(new THREE.Texture()),
    view = new ScenerySprites(),
    c = chunk();
  try {
    c.objects = buildingObjects(
      c,
      [b],
      new Map([["1,-1,-1", "DisplayFurniture"]]),
      art,
      new Map(),
      new Map(),
      defs,
    );
    view.update([c], new Map([["0,0,4", c]]));
    const materials = view.group.children[0].children
      .filter((o) => o instanceof THREE.Mesh)
      .map((o) => (o as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .filter((m) => m.transparent);
    expect(materials.length).toBeGreaterThan(0);
    for (const m of materials) {
      expect(m.depthWrite).toBe(false);
      expect(m.alphaTest).toBeLessThan(m.opacity * 0.75);
    }
  } finally {
    view.dispose();
    load.mockRestore();
  }
});

it("uses material-specific and default weapon sprites for actual displayed items", () => {
  const defs = new Map([
      ["1,0", "WEAPON/ITEM_WEAPON_SWORD_SHORT"],
      ["2,0", "TOY/ITEM_TOY_BOAT"],
    ]),
    mats = new Map([["0,1", { id: "INORGANIC:IRON", name: "iron" }]]);
  const graphics = {
    metalIds: new Set(["INORGANIC:IRON"]),
    get: (key: string) =>
      ({
        "ITEM_WEAPON_SWORD_SHORT:DEFAULT": figure,
        "ITEM_WEAPON_SWORD_SHORT:WOOD": crown,
        "ITEM_TOY_BOAT:METAL": base,
      })[key],
  };
  const item = {
    type: { matType: 1, matIndex: 0 },
    material: { matType: 0, matIndex: 1 },
  };
  expect(displayItemLayers(item, defs, mats, graphics)).toEqual([
    { sprite: figure },
  ]);
  expect(
    displayItemLayers({ ...item, material: undefined }, defs, mats, graphics),
  ).toEqual([{ sprite: crown }]);
  expect(
    displayItemLayers(
      { ...item, type: { matType: 2, matIndex: 0 } },
      defs,
      mats,
      graphics,
    ),
  ).toEqual([{ sprite: base }]);
});
