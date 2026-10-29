import { it, expect } from "vitest";
import {
  parseDwarfLayers,
  chooseDwarfLayers,
  type DwarfAppearance,
} from "../src/bridge/dwarf-layers.js";
import { recolor } from "../src/viewer/composite-sprites.js";
import { parseServerMessage } from "../src/shared/validation.js";
const text = `[LAYER_SET:DEFAULT][LS_PALETTE:BODY][LS_PALETTE_FILE:images/body.png][LS_PALETTE_DEFAULT:0]
[LAYER_GROUP][LAYER:SKIN:BODY:0:0][CONDITION_CASTE:MALE][CONDITION_TISSUE_LAYER:BY_CATEGORY:ALL:SKIN][TISSUE_MAY_HAVE_COLOR:PINK][USE_PALETTE:BODY:1]
[LAYER_GROUP][LAYER:SHIRT:CLOTHES:1:0][CONDITION_ITEM_WORN:BY_CATEGORY:BODY_UPPER:ARMOR:ITEM_ARMOR_SHIRT][USE_STANDARD_PALETTE_FROM_ITEM]
[LAYER_GROUP][LAYER:PICK:WEAPONS:LARGE_IMAGE:2:3:3:3][CONDITION_ITEM_WORN:BY_TOKEN:LH:WEAPON:ITEM_WEAPON_PICK][USE_STANDARD_PALETTE_FROM_ITEM]
[LAYER_GROUP][LAYER:MAGIC:BODY:0:0][CONDITION_SYN_CLASS:ZOMBIE]`;
const appearance: DwarfAppearance = {
  caste: "MALE",
  age: 30,
  skin: "PINK",
  items: [],
};
const resolve = (
  _page: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => ({
  asset: "a".repeat(24),
  x: x * 32,
  y: y * 32,
  width: w * 32,
  height: h * 32,
  pageWidth: 512,
  pageHeight: 512,
});
it("selects body palette and worn clothes from actual attachments", () => {
  const sets = parseDwarfLayers(text);
  let result = chooseDwarfLayers(sets, appearance, resolve, () =>
    "b".repeat(24),
  );
  expect(result).toHaveLength(1);
  expect(result[0].palette?.row).toBe(1);
  result = chooseDwarfLayers(
    sets,
    {
      ...appearance,
      items: [
        {
          type: "ARMOR",
          subtype: "ITEM_ARMOR_SHIRT",
          bodyToken: "UB",
          bodyCategory: "BODY_UPPER",
          color: [20, 40, 60],
        },
      ],
    },
    resolve,
    () => "b".repeat(24),
  );
  expect(result).toHaveLength(2);
  expect(result[1].tint).toEqual([20, 40, 60]);
});
it("selects held equipment only in its matching hand and preserves large-image extent", () => {
  const item = {
    type: "WEAPON",
    subtype: "ITEM_WEAPON_PICK",
    bodyToken: "LH",
    bodyCategory: "HAND",
  };
  const selected = chooseDwarfLayers(
    parseDwarfLayers(text),
    { ...appearance, items: [item] },
    resolve,
    () => "b".repeat(24),
  );
  expect(selected).toHaveLength(2);
  expect(selected[1].sprite.width).toBe(64);
  expect(
    chooseDwarfLayers(
      parseDwarfLayers(text),
      { ...appearance, items: [{ ...item, bodyToken: "RH" }] },
      resolve,
      () => "b".repeat(24),
    ),
  ).toHaveLength(1);
});
it("fails closed on special conditions and chooses age/caste sets", () => {
  expect(
    chooseDwarfLayers(
      parseDwarfLayers(text),
      { ...appearance, caste: "FEMALE" },
      resolve,
      () => "b".repeat(24),
    ),
  ).toHaveLength(0);
  expect(
    chooseDwarfLayers(
      parseDwarfLayers(text),
      { ...appearance, age: 5 },
      resolve,
      () => "b".repeat(24),
    ),
  ).toHaveLength(0);
});
it("remaps exact palette entries, preserves alpha and shades item colours", () => {
  const pixels = new Uint8ClampedArray([10, 20, 30, 123, 99, 99, 99, 0]);
  recolor(
    pixels,
    new Uint8ClampedArray([10, 20, 30, 255]),
    new Uint8ClampedArray([200, 100, 50, 255]),
  );
  expect([...pixels]).toEqual([200, 100, 50, 123, 99, 99, 99, 0]);
  const tinted = new Uint8ClampedArray([128, 128, 128, 255]);
  recolor(tinted, undefined, undefined, [200, 100, 50]);
  expect([...tinted]).toEqual([100, 50, 25, 255]);
});
it("validates layer counts and palette asset identifiers", () => {
  const base = {
    type: "creatures",
    session: "s",
    tick: 1,
    creatures: [
      {
        id: 1,
        x: 0,
        y: 0,
        z: 0,
        name: "Test",
        layers: [
          {
            sprite: resolve("", 0, 0, 1, 1),
            palette: { asset: "../secret", row: 0, sourceRow: 0 },
          },
        ],
      },
    ],
  };
  expect(() => parseServerMessage(base)).toThrow();
});
it("selects the supported artifact branch and suppresses covered garments", () => {
  const sets = parseDwarfLayers(
    "[LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:ART:CLOTHES:1:0][CONDITION_ITEM_WORN:BY_CATEGORY:HEAD:HELM:CAP][CONDITION_MATERIAL_FLAG:IS_CRAFTED_ARTIFACT][LAYER:NORMAL:CLOTHES:2:0][CONDITION_ITEM_WORN:BY_CATEGORY:HEAD:HELM:CAP][CONDITION_MATERIAL_FLAG:NOT_ARTIFACT]",
  );
  const item = {
    type: "HELM",
    subtype: "CAP",
    bodyToken: "HD",
    bodyCategory: "HEAD",
    artifact: false,
  };
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, items: [item] },
      resolve,
      () => undefined,
    )[0].sprite.x,
  ).toBe(64);
  expect(
    chooseDwarfLayers(
      sets,
      { ...appearance, items: [{ ...item, artifact: true }] },
      resolve,
      () => undefined,
    )[0].sprite.x,
  ).toBe(32);
});
it("uses an explicit default face variant instead of omitting the head", () => {
  const sets = parseDwarfLayers(
    "[LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:FACE2:BODY:2:0][CONDITION_RANDOM_PART_INDEX:HEAD:2:4][LAYER:FACE1:BODY:1:0][CONDITION_RANDOM_PART_INDEX:HEAD:1:4]",
  );
  expect(
    chooseDwarfLayers(sets, appearance, resolve, () => undefined)[0].sprite.x,
  ).toBe(32);
});
