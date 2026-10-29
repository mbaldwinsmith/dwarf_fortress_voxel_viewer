import { it, expect } from "vitest";
import { hairAppearance } from "../src/bridge/hair.js";
import {
  parseDwarfLayers,
  chooseDwarfLayers,
  type DwarfAppearance,
} from "../src/bridge/dwarf-layers.js";
import { compositionBounds } from "../src/viewer/composite-sprites.js";
const caste = {
  bodyParts: [
    {
      category: "HEAD",
      layers: [
        { layerName: "HAIR", bpModifiers: [2] },
        { layerName: "CHIN_WHISKERS", bpModifiers: [3] },
      ],
    },
  ],
  modifiers: [{ type: "LENGTH" }, { type: "CURLY" }],
  modifierIdx: [0, 0, 1, 1],
  colorModifiers: [
    {
      patterns: [{ id: "BLACK" }, { id: "AUBURN" }],
      bodyPartId: [0, 0],
      tissueLayerId: [0, 1],
      startDate: 0,
    },
    {
      patterns: [{ id: "GRAY" }],
      bodyPartId: [0, 0],
      tissueLayerId: [0, 1],
      startDate: 26880,
    },
  ],
};
it("reads independent grooming and maps expanded curl indices to actual tissue modifiers", () => {
  const result = hairAppearance(
    caste,
    {
      colors: [1, 0],
      bpModifiers: [0, 0, 170, 90],
      hair: { length: 200, style: 2 },
      beard: { length: 100, style: 1 },
    },
    40,
  );
  expect(result).toEqual({
    hair: { length: 200, style: 2, color: "AUBURN", curly: 170 },
    beard: { length: 100, style: 1, color: "AUBURN", curly: 90 },
  });
  expect(
    hairAppearance(
      caste,
      { colors: [1, 0], hair: { length: 200, style: 0 } },
      80,
    ).hair?.color,
  ).toBe("GRAY");
});
it("does not invent missing colours or unsupported styles", () => {
  expect(hairAppearance(caste, { hair: { length: 50, style: 0 } }, 40)).toEqual(
    {},
  );
  expect(
    hairAppearance(caste, { colors: [0], hair: { length: 50, style: 99 } }, 40),
  ).toEqual({});
});
const resolve = (_p: string, x: number, y: number, w: number, h: number) => ({
  asset: "a".repeat(24),
  x: x * 32,
  y: y * 32,
  width: w * 32,
  height: h * 32,
  pageWidth: 512,
  pageHeight: 1024,
});
const base: DwarfAppearance = {
  age: 30,
  caste: "MALE",
  skin: "PINK",
  items: [],
};
const rules = (style: string) =>
  parseDwarfLayers(
    `[LAYER_SET:DEFAULT][LS_PALETTE:HAIR][LS_PALETTE_FILE:images/palette.png][LAYER_GROUP][LAYER:HAIR:HAIR:2:1][CONDITION_TISSUE_LAYER:BY_CATEGORY:HEAD:HAIR][TISSUE_MIN_LENGTH:50][TISSUE_MAX_LENGTH:99][${style}][TISSUE_MAY_HAVE_COLOR:BLACK][TISSUE_SWAP:IF_MIN_CURLY:150:HAIR:0:1][USE_PALETTE:HAIR:12][SHUT_OFF_IF_ITEM_PRESENT:BY_CATEGORY:HEAD:HELM:HOOD]`,
  );
it.each([
  [-1, "TISSUE_NOT_SHAPED"],
  [0, "TISSUE_MAY_HAVE_SHAPING:NEATLY_COMBED"],
  [1, "TISSUE_MAY_HAVE_SHAPING:BRAIDED"],
  [2, "TISSUE_MAY_HAVE_SHAPING:DOUBLE_BRAIDS"],
  [3, "TISSUE_MAY_HAVE_SHAPING:PONY_TAILS"],
])("matches grooming style %s", (style, token) => {
  const selected = chooseDwarfLayers(
    rules(String(token)),
    {
      ...base,
      hair: { length: 50, style: Number(style), color: "BLACK", curly: 170 },
    },
    resolve,
    () => "b".repeat(24),
  );
  expect(selected).toHaveLength(1);
  expect(selected[0].sprite.x).toBe(0);
  expect(selected[0].palette?.row).toBe(12);
});
it("respects length boundaries, clean shaving and headwear suppression", () => {
  const sets = rules("TISSUE_NOT_SHAPED"),
    make = (length: number, style = -1) => ({
      ...base,
      hair: { length, style, color: "BLACK" },
    });
  for (const length of [0, 49, 100])
    expect(
      chooseDwarfLayers(sets, make(length), resolve, () => "b".repeat(24)),
    ).toHaveLength(0);
  expect(
    chooseDwarfLayers(sets, make(99), resolve, () => "b".repeat(24)),
  ).toHaveLength(1);
  expect(
    chooseDwarfLayers(sets, make(50, 4), resolve, () => "b".repeat(24)),
  ).toHaveLength(0);
  expect(
    chooseDwarfLayers(
      sets,
      {
        ...make(50),
        items: [
          {
            type: "HELM",
            subtype: "HOOD",
            bodyToken: "HD",
            bodyCategory: "HEAD",
          },
        ],
      },
      resolve,
      () => "b".repeat(24),
    ),
  ).toHaveLength(0);
});
it("matches beard grooming separately from scalp hair and supports large curly swaps", () => {
  const sets = parseDwarfLayers(
    "[LAYER_SET:DEFAULT][LAYER_GROUP][LAYER:BEARD:HAIR:2:0][CONDITION_TISSUE_LAYER:BY_CATEGORY:HEAD:CHIN_WHISKERS][TISSUE_MAY_HAVE_SHAPING:BRAIDED][TISSUE_MAY_HAVE_COLOR:AUBURN][TISSUE_SWAP:IF_MIN_CURLY:150:HAIR:LARGE_IMAGE:1:13:1:14]",
  );
  const result = chooseDwarfLayers(
    sets,
    {
      ...base,
      hair: { length: 50, style: 0, color: "BLACK" },
      beard: { length: 200, style: 1, color: "AUBURN", curly: 160 },
    },
    resolve,
    () => undefined,
  );
  expect(result).toHaveLength(1);
  expect(result[0].sprite.height).toBe(64);
  const body = { sprite: resolve("", 0, 0, 1, 1) };
  expect(compositionBounds([body, result[0]])).toEqual({
    width: 32,
    height: 64,
    minY: -32,
    footFromBottom: 0,
  });
});
