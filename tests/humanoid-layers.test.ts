import { it, expect, vi } from "vitest";
import * as THREE from "three";
import {
  layerTemplates,
  expandLayerTemplates,
} from "../src/bridge/layer-templates.js";
import {
  parseDwarfLayers,
  chooseDwarfLayers,
  type DwarfAppearance,
} from "../src/bridge/dwarf-layers.js";
import { professionCategories } from "../src/bridge/professions.js";
import {
  CompositeSprites,
  compositionBounds,
} from "../src/viewer/composite-sprites.js";
import type { SpriteLayer } from "../src/shared/model.js";
import { CreatureReader } from "../src/bridge/creatures.js";
import type { FortressAdapter } from "../src/bridge/adapter.js";
import type { Graphics } from "../src/bridge/graphics.js";
import { parseServerMessage } from "../src/shared/validation.js";
const resolve = (_p: string, x: number, y: number, w: number, h: number) => ({
  asset: "a".repeat(24),
  x: x * 32,
  y: y * 32,
  width: w * 32,
  height: h * 32,
  pageWidth: 16384,
  pageHeight: 4096,
});
const appearance: DwarfAppearance = {
  caste: "MALE",
  age: 30,
  skin: "PINK",
  state: "DEFAULT",
  items: [],
};
it("passes live non-dwarf anatomy, held/worn/hauling inventory and material flags to the layer evaluator", async () => {
  const unit = {
    id: 4,
    posX: 2,
    posY: 2,
    posZ: 4,
    flags1: 0,
    flags3: 1 << 12,
    race: { matType: 7, matIndex: 0 },
    age: 3,
    professionId: 2,
    sizeInfo: { sizeCur: 6000 },
    appearance: { colors: [0] },
    inventory: [
      {
        mode: 1,
        bodyPartId: 1,
        item: {
          type: { matType: 1, matIndex: 0 },
          material: { matType: 420, matIndex: 0 },
          flags1: 0,
          flags2: 4,
        },
      },
      {
        mode: 2,
        bodyPartId: 0,
        item: {
          type: { matType: 2, matIndex: 0 },
          material: { matType: 0, matIndex: 0 },
        },
      },
      {
        mode: 0,
        bodyPartId: -1,
        item: {
          type: { matType: 3, matIndex: 0 },
          material: { matType: 420, matIndex: 0 },
        },
      },
    ],
  };
  const call = vi.fn(async (method: string) => {
    if (method === "GetItemList")
      return {
        materialList: [
          {
            matPair: { matType: 1, matIndex: 0 },
            id: "WEAPON/ITEM_WEAPON_SWORD_SHORT",
          },
          { matPair: { matType: 2, matIndex: 0 }, id: "HELM/ITEM_HELM_HELM" },
          { matPair: { matType: 3, matIndex: 0 }, id: "BLOCKS" },
        ],
      };
    if (method === "GetMaterialList")
      return {
        materialList: [
          {
            matPair: { matType: 420, matIndex: 0 },
            id: "PLANT:OAK:WOOD",
            stateColor: { red: 140, green: 80, blue: 40 },
          },
          {
            matPair: { matType: 0, matIndex: 0 },
            id: "INORGANIC:IRON",
            stateColor: { red: 128, green: 128, blue: 128 },
          },
        ],
      };
    if (method === "GetUnitListInside") return { creatureList: [unit] };
    if (method === "GetPartialCreatureRaws")
      return {
        creatureRaws: [
          {
            index: 7,
            creatureId: "HUMAN",
            caste: [
              {
                index: 0,
                casteId: "MALE",
                bodyParts: [
                  { token: "HEAD", category: "HEAD" },
                  { token: "RH", category: "HAND" },
                ],
                colorModifiers: [{ part: "SKIN", patterns: [{ id: "PINK" }] }],
              },
            ],
          },
        ],
      };
    throw Error(method);
  });
  const layered = vi.fn(() => [
    { sprite: resolve("", 0, 0, 1, 1) },
    { sprite: resolve("", 1, 0, 1, 1) },
  ]);
  const graphics = {
    resolve: () => undefined,
    supportsLayers: () => true,
    layered,
  } as unknown as Graphics;
  const reader = new CreatureReader(
    { rpc: { call } } as unknown as FortressAdapter,
    graphics,
  );
  const chunk = {
    x: 0,
    y: 0,
    z: 4,
    tiles: Array.from({ length: 256 }, () => ({
      shape: "floor" as const,
      material: 2,
      name: "Floor",
    })),
  };
  const result = await reader.snapshot(
    { x: 0, y: 0, z: 0, width: 16, depth: 16, height: 20 },
    4,
    new Map([["0,0,4", chunk]]),
  );
  expect(result[0].layers).toHaveLength(2);
  expect(result[0].bodySize).toBe(60000);
  const [, evaluated] = layered.mock.calls[0] as unknown as [
    string,
    DwarfAppearance,
  ];
  expect(evaluated.state).toBe("DEFAULT");
  expect(evaluated.skin).toBe("PINK");
  expect(evaluated.ghost).toBe(true);
  expect(evaluated.bodySize).toBe(60000);
  expect(evaluated.haulCount).toBe(1);
  expect(evaluated.items[0]).toMatchObject({
    bodyToken: "RH",
    mode: 1,
    color: [140, 80, 40],
    materialFlags: ["ANY_WOOD_MATERIAL", "GROWN_NOT_CRAFTED"],
  });
  expect(evaluated.items[1]).toMatchObject({
    bodyToken: "HEAD",
    mode: 2,
    materialType: "INORGANIC",
  });
  expect(evaluated.items[2]).toMatchObject({
    bodyToken: "",
    mode: 0,
    type: "BLOCKS",
  });
});
it("expands native body/weapon template arguments, permitted limbs and pixel offsets", () => {
  const templates = layerTemplates([
    "[LAYER_SET_TEMPLATE:PEOPLE][LAYER_GROUP][LG_PERMITTED:ARG_HEAD][LG_OFFSET:ARG_HEAD_OFFSETS][LAYER:HEAD:ARG_HEAD_TEXTURE][LAYER_GROUP][LG_PERMITTED:ARG_WING][LAYER:WING:WINGS:0:0][LAYER_GROUP][LG_PERMITTED:ARG_HAND][LG_OFFSET:ARG_WEAPON_OFFSET][LAYER:SWORD:WIELDABLES:LARGE_IMAGE:0:7:1:7][CONDITION_ITEM_WORN:BY_TOKEN:ARG_RH:WEAPON:ITEM_WEAPON_SWORD_SHORT]",
  ]);
  const expanded = expandLayerTemplates(
    "[LAYER_SET:DEFAULT][USE_LAYER_SET_TEMPLATE:PEOPLE][ARG_HEAD:YES][ARG_HEAD_OFFSETS:2:-3][ARG_HEAD_TEXTURE:BODY:LARGE_IMAGE:1:2:1:3][ARG_HAND:YES][ARG_WEAPON_OFFSET:-6:4][ARG_RH:RH][LAYER_SET:CORPSE][LAYER:BODY:DEAD:0:0]",
    templates,
  );
  const sets = parseDwarfLayers(expanded);
  expect(sets).toHaveLength(2);
  const layers = chooseDwarfLayers(
    sets,
    {
      ...appearance,
      items: [
        {
          type: "WEAPON",
          subtype: "ITEM_WEAPON_SWORD_SHORT",
          bodyToken: "RH",
          bodyCategory: "HAND",
          mode: 1,
        },
      ],
    },
    resolve,
    () => undefined,
  );
  expect(layers).toHaveLength(2);
  expect(layers[0].offset).toEqual([2, -3]);
  expect(layers[0].sprite.height).toBe(64);
  expect(layers[1].offset).toEqual([-6, 4]);
  expect(layers[1].sprite.width).toBe(64);
  expect(
    chooseDwarfLayers(
      sets,
      {
        ...appearance,
        items: [
          {
            type: "WEAPON",
            subtype: "ITEM_WEAPON_SWORD_SHORT",
            bodyToken: "LH",
            bodyCategory: "HAND",
          },
        ],
      },
      resolve,
      () => undefined,
    ),
  ).toHaveLength(1);
});
it("evaluates native grown/material, size and hauled-equipment branches in order", () => {
  const sets = parseDwarfLayers(
    "[LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:GROWN:WEAPONS:0:0][CONDITION_ITEM_WORN:BY_TOKEN:RH:SHIELD:ITEM_SHIELD_SHIELD][CONDITION_MATERIAL_FLAG:ANY_WOOD_MATERIAL:GROWN_NOT_CRAFTED][USE_STANDARD_PALETTE_FROM_ITEM][LAYER:WOOD:WEAPONS:1:0][CONDITION_ITEM_WORN:BY_TOKEN:RH:SHIELD:ITEM_SHIELD_SHIELD][CONDITION_MATERIAL_FLAG:ANY_WOOD_MATERIAL][LAYER:METAL:WEAPONS:2:0][CONDITION_ITEM_WORN:BY_TOKEN:RH:SHIELD:ITEM_SHIELD_SHIELD][CONDITION_MATERIAL_TYPE:INORGANIC][LAYER_GROUP][LAYER:SIEGE:BODY:3:0][CONDITION_BODY_SIZE_MIN:4500000][CONDITION_HAUL_COUNT_MIN:1][CONDITION_ITEM_WORN:ANY_HAULED:BLOCKS:ANY]",
  );
  const shield = {
    type: "SHIELD",
    subtype: "ITEM_SHIELD_SHIELD",
    bodyToken: "RH",
    bodyCategory: "HAND",
    color: [180, 90, 30] as [number, number, number],
  };
  const pick = (flags: string[], type?: string) =>
    chooseDwarfLayers(
      sets,
      {
        ...appearance,
        items: [{ ...shield, materialFlags: flags, materialType: type }],
      },
      resolve,
      () => undefined,
    );
  expect(pick(["ANY_WOOD_MATERIAL", "GROWN_NOT_CRAFTED"])[0].sprite.x).toBe(0);
  expect(pick(["ANY_WOOD_MATERIAL"])[0].sprite.x).toBe(32);
  expect(pick([], "INORGANIC")[0].sprite.x).toBe(64);
  const hauled = {
    type: "BLOCKS",
    subtype: "",
    bodyToken: "",
    bodyCategory: "",
    mode: 0,
  };
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, bodySize: 5000000, haulCount: 1, items: [hauled] },
      resolve,
      () => undefined,
    )[0].sprite.x,
  ).toBe(96);
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, bodySize: 3000000, haulCount: 1, items: [hauled] },
      resolve,
      () => undefined,
    ),
  ).toHaveLength(0);
});
it("uses native profession state rather than applying dwarf child ages to all peoples", () => {
  expect(professionCategories(0)).toEqual(["MINER"]);
  expect(professionCategories(2)).toContain("WOODWORKER");
  expect(professionCategories(-1)).toEqual([]);
  const sets = parseDwarfLayers(
    "[LAYER_SET:BABY:DEFAULT][LAYER_GROUP][LAYER:BABY:BODY:0:0][LAYER_SET:CHILD:DEFAULT][LAYER_GROUP][LAYER:CHILD:BODY:1:0][LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:ADULT:BODY:2:0]",
  );
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, age: 2, state: "DEFAULT" },
      resolve,
      () => undefined,
    )[0].sprite.x,
  ).toBe(64);
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, age: 2, state: "CHILD" },
      resolve,
      () => undefined,
    )[0].sprite.x,
  ).toBe(32);
});
it("supports unassigned wielded weapons and independent native random body-part groups", () => {
  const sets = parseDwarfLayers(
    "[LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:WIELD:WEAPONS:LARGE_IMAGE:0:0:2:1][CONDITION_ITEM_WORN:WIELD:WEAPON:ITEM_WEAPON_PICK_GREAT][LAYER_GROUP][LAYER:NOSE:BODY:1:0][CONDITION_RANDOM_PART_INDEX:NOSE:1:2][LAYER:OTHER_NOSE:BODY:2:0][CONDITION_RANDOM_PART_INDEX:NOSE:2:2]",
  );
  const item = {
    type: "WEAPON",
    subtype: "ITEM_WEAPON_PICK_GREAT",
    bodyToken: "LH",
    bodyCategory: "HAND",
    mode: 1,
  };
  const one = chooseDwarfLayers(
    sets,
    { ...appearance, variantSeed: 51, items: [item] },
    resolve,
    () => undefined,
  );
  expect(one).toHaveLength(2);
  expect(one[0].sprite.width).toBe(96);
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, variantSeed: 51, items: [{ ...item, mode: 0 }] },
      resolve,
      () => undefined,
    ),
  ).toHaveLength(1);
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, variantSeed: 51, items: [item] },
      resolve,
      () => undefined,
    ),
  ).toEqual(one);
});
it("keeps offset weapons and tall/wide body parts inside a common anchored canvas", () => {
  const layers: SpriteLayer[] = [
    { sprite: resolve("", 0, 0, 1, 1) },
    { sprite: resolve("", 0, 0, 2, 2), offset: [-6, -3] },
    { sprite: resolve("", 0, 0, 1, 1), offset: [8, 4] },
  ];
  expect(compositionBounds(layers)).toEqual({
    minX: -38,
    minY: -35,
    width: 78,
    height: 71,
    anchorX: 54,
    footFromBottom: 4,
  });
});
it("accepts bounded layer offsets and rejects malformed bridge coordinates", () => {
  const layer: SpriteLayer = {
    sprite: resolve("", 0, 0, 1, 1),
    offset: [-6, 4],
  };
  const message = {
    type: "creatures",
    session: "test",
    tick: 1,
    creatures: [{ id: 1, x: 0, y: 0, z: 0, name: "Human", layers: [layer] }],
  };
  expect(() => parseServerMessage(message)).not.toThrow();
  layer.offset = [-513, 0];
  expect(() => parseServerMessage(message)).toThrow();
  layer.offset = [0, NaN];
  expect(() => parseServerMessage(message)).toThrow();
});
it("retains all active humanoids beyond the old 256-appearance limit and frees obsolete equipment", () => {
  vi.stubGlobal(
    "Image",
    class {
      set src(_value: string) {}
    },
  );
  const composites = new CompositeSprites(),
    fallback = new THREE.SpriteMaterial();
  const appearances = Array.from({ length: 300 }, (_, i) => [
    { sprite: resolve("", i, 0, 1, 1) },
  ]);
  try {
    composites.retain(appearances);
    const materials = appearances.map((l) => composites.material(l, fallback));
    expect(materials.every((m) => m !== fallback)).toBe(true);
    const disposed = vi.fn();
    materials[0].addEventListener("dispose", disposed);
    composites.retain([appearances[299]]);
    expect(disposed).toHaveBeenCalledOnce();
    expect(composites.material(appearances[299], fallback)).toBe(
      materials[299],
    );
  } finally {
    composites.dispose();
    fallback.dispose();
    vi.unstubAllGlobals();
  }
});
