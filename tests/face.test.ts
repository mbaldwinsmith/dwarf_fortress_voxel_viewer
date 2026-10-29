import { it, expect } from "vitest";
import { eyeColor, faceVariant } from "../src/bridge/face.js";
import {
  parseDwarfLayers,
  chooseDwarfLayers,
} from "../src/bridge/dwarf-layers.js";
import { recolor } from "../src/viewer/composite-sprites.js";
import { parseServerMessage } from "../src/shared/validation.js";
const raw = {
  bodyParts: [{ category: "HEAD" }, { category: "EYE" }],
  colorModifiers: [
    { bodyPartId: [0], patterns: [{ id: "BLACK" }] },
    {
      bodyPartId: [1],
      patterns: [
        {
          id: "IRIS_EYE_BLUE",
          colors: [
            { red: 255, green: 255, blue: 255 },
            { red: 0, green: 0, blue: 0 },
            { red: 0, green: 128, blue: 255 },
          ],
        },
      ],
    },
  ],
};
it("reads the selected eye pattern iris, not sclera, pupil or hair", () => {
  expect(eyeColor(raw, { colors: [0, 0] })).toEqual([0, 128, 255]);
  expect(eyeColor(raw, { colors: [0, 9] })).toBeUndefined();
  expect(eyeColor(raw, {})).toBeUndefined();
  expect(
    eyeColor(
      { ...raw, bodyParts: [{ category: "HEAD" }, { category: "HAIR" }] },
      { colors: [0, 0] },
    ),
  ).toBeUndefined();
});
it("rejects malformed eye RGB", () => {
  const copy = structuredClone(raw);
  const pattern = copy.colorModifiers[1].patterns[0];
  if ("colors" in pattern) pattern.colors[2].red = 256;
  expect(eyeColor(copy, { colors: [0, 0] })).toBeUndefined();
});
it("keeps faces stable and distributes native variants across unit IDs", () => {
  const choices = Array.from({ length: 100 }, (_, i) => faceVariant(i));
  expect(new Set(choices)).toEqual(new Set([1, 2, 3, 4]));
  expect(faceVariant(1233)).toBe(faceVariant(1233));
});
const sprite = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 288,
  pageHeight: 224,
};
it.each([0, 3])(
  "selects native face variants and confines eye tint to vanilla face row %s",
  (row) => {
    const sets = parseDwarfLayers(
      "[LAYER_SET:DEFAULT][LAYER_GROUP]" +
        [1, 2, 3, 4]
          .map(
            (i) =>
              `[LAYER:FACE${i}:DWARF_BODY:${i - 1}:${row}][CONDITION_RANDOM_PART_INDEX:HEAD:${i}:4]`,
          )
          .join("") +
        "[END_LAYER_GROUP][LAYER_GROUP][LAYER:CLOTHING:DWARF_BODY:0:0]",
    );
    for (const variant of [1, 2, 3, 4]) {
      const layers = chooseDwarfLayers(
        sets,
        {
          age: 30,
          caste: "FEMALE",
          skin: "PINK",
          items: [],
          faceVariant: variant,
          eyeColor: [0, 128, 255],
        },
        (_p, x, y) => ({ ...sprite, x: x * 32, y: y * 32 }),
        () => undefined,
      );
      expect(layers[0].sprite.x).toBe((variant - 1) * 32);
      expect(layers[0].eyeColor).toEqual([0, 128, 255]);
      expect(layers[1].eyeColor).toBeUndefined();
    }
  },
);
it("colours opaque pupil pixels while preserving outlines, skin and transparency", () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255, 40, 40, 41, 255, 255, 196, 159, 255, 0, 0, 0, 0,
  ]);
  recolor(
    pixels,
    new Uint8ClampedArray([255, 196, 159, 255]),
    new Uint8ClampedArray([100, 80, 60, 255]),
    undefined,
    [0, 128, 255],
  );
  expect([...pixels]).toEqual([
    0, 90, 179, 255, 40, 40, 41, 255, 100, 80, 60, 255, 0, 0, 0, 0,
  ]);
});
it("validates eye colour on the wire", () => {
  const message = (eyeColor: unknown) => ({
    type: "creatures",
    session: "s",
    tick: 1,
    creatures: [
      {
        id: 1,
        x: 1,
        y: 1,
        z: 1,
        name: "Dwarf",
        layers: [{ sprite, eyeColor }],
      },
    ],
  });
  expect(() => parseServerMessage(message([0, 128, 255]))).not.toThrow();
  for (const invalid of [[256, 0, 0], [-1, 0, 0], [1, 2], [1, 2, NaN], "blue"])
    expect(() => parseServerMessage(message(invalid))).toThrow();
});
