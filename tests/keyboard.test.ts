import { expect, it } from "vitest";
import { levelDirection } from "../src/viewer/keyboard.js";
it("uses shifted angle-bracket shortcuts and ignores plain punctuation or command chords", () => {
  expect(levelDirection({ code: "Comma", shiftKey: true })).toBe(1);
  expect(levelDirection({ code: "Period", shiftKey: true })).toBe(-1);
  expect(levelDirection({ key: "<" })).toBe(1);
  expect(levelDirection({ key: ">" })).toBe(-1);
  for (const e of [
    { code: "Comma" },
    { code: "Period" },
    { key: "[" },
    { key: "]" },
    { key: "<", ctrlKey: true },
    { code: "Comma", shiftKey: true, altKey: true },
  ])
    expect(levelDirection(e)).toBe(0);
});
