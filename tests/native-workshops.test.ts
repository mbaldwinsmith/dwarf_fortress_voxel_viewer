import { afterEach, expect, it, vi } from "vitest";
import type { SceneryObject, SpriteRef } from "../src/shared/model.js";
import { nativeWorkshopRelief } from "../src/viewer/native-workshop-relief.js";
import { NativeWorkshops } from "../src/viewer/native-workshops.js";
import { NativeWorkshopGeometry } from "../src/viewer/native-workshop-geometry.js";
import {
  hasNativeWorkshop,
  registerNativeWorkshop,
  workshopFaces,
} from "../src/viewer/workshop-models.js";
const ref: SpriteRef = {
  asset: "c".repeat(24),
  x: 0,
  y: 0,
  width: 96,
  height: 128,
  pageWidth: 96,
  pageHeight: 128,
};
const object = (asset = ref.asset): SceneryObject => ({
  id: "b:test",
  x: 15,
  y: 2,
  z: 4,
  name: "Crafts",
  kind: "ground",
  sprite: { ...ref, asset, width: 32, height: 32 },
  workshop: {
    type: "WORKSHOP_CRAFTS",
    col: 0,
    row: 0,
    width: 3,
    depth: 3,
    art: { base: { ...ref, asset }, decor: { ...ref, asset } },
  },
});
afterEach(() => vi.unstubAllGlobals());
it("keeps L-shaped worktops horizontal and native tools on their raised surface", () => {
  const base = new Uint8ClampedArray(96 * 128 * 4),
    decor = new Uint8ClampedArray(base.length);
  const fill = (
    out: Uint8ClampedArray,
    x: number,
    y: number,
    X: number,
    Y: number,
    color: number[],
  ) => {
    for (let b = y; b < Y; b++)
      for (let a = x; a < X; a++) out.set(color, (b * 96 + a) * 4);
  };
  fill(base, 0, 0, 96, 128, [107, 112, 118, 255]);
  fill(base, 4, 64, 28, 120, [165, 166, 165, 255]);
  fill(base, 4, 96, 68, 120, [165, 166, 165, 255]);
  fill(decor, 8, 75, 19, 85, [140, 70, 30, 255]);
  const o = object(),
    faces = nativeWorkshopRelief(o, {
      width: 96,
      height: 128,
      base,
      decor,
      background: new Uint8ClampedArray(base),
    });
  expect(faces.length).toBeGreaterThan(10);
  const tools = faces.filter((f) => f.sprite === o.workshop!.art!.decor);
  expect(tools.length).toBeGreaterThan(0);
  expect(
    Math.min(
      ...tools.flatMap((f) => f.positions.filter((_, i) => i % 3 === 1)),
    ),
  ).toBeCloseTo(0.38);
  expect(
    Math.max(
      ...faces.flatMap((f) => f.positions.filter((_, i) => i % 3 === 1)),
    ),
  ).toBeCloseTo(0.405);
  expect(faces.every((f) => f.positions.every(Number.isFinite))).toBe(true);
  registerNativeWorkshop(o, faces);
  const cell = workshopFaces(o, 4.12);
  expect(
    cell.every((f) =>
      f.positions.every((v, i) => i % 3 !== 0 || (v >= 15 && v <= 16)),
    ),
  ).toBe(true);
});
it("raises native cloth that overlaps the rear edge of a tabletop", () => {
  const base = new Uint8ClampedArray(96 * 128 * 4),
    decor = new Uint8ClampedArray(base.length);
  for (let y = 26; y < 51; y++)
    for (let x = 3; x < 31; x++)
      base.set([165, 166, 165, 255], (y * 96 + x) * 4);
  for (let y = 23; y < 48; y++)
    for (let x = 4; x < 30; x++)
      decor.set([40, 60, 140, 255], (y * 96 + x) * 4);
  const o = object();
  o.workshop!.type = "WORKSHOP_CLOTHES";
  const faces = nativeWorkshopRelief(o, {
    width: 96,
    height: 128,
    base,
    decor,
    background: new Uint8ClampedArray(base),
  });
  const detail = faces.filter((f) => f.sprite === o.workshop!.art!.decor);
  expect(detail.length).toBeGreaterThan(0);
  const ys = detail.flatMap((f) => f.positions.filter((_, i) => i % 3 === 1));
  expect(Math.min(...ys)).toBeCloseTo(0.38);
  expect(Math.max(...ys)).toBeCloseTo(0.405);
  expect(
    detail.every((f) =>
      f.positions.every((v, i) => i % 3 !== 2 || (v >= 0.025 && v <= 0.6)),
    ),
  ).toBe(true);
});
it("selects opaque wood below the transparent decorative row for shafts", () => {
  const base = new Uint8ClampedArray(96 * 128 * 4);
  for (let y = 34; y < 40; y++)
    for (let x = 12; x < 19; x++)
      base.set([130, 85, 45, 255], (y * 96 + x) * 4);
  const o = object(),
    g = new NativeWorkshopGeometry(o, { width: 96, height: 128, base });
  const skin = g.patch([8, 20, 25, 45], true, "wood");
  expect(skin.rect[0]).toBeGreaterThanOrEqual(12);
  expect(skin.rect[1]).toBeGreaterThanOrEqual(34);
  expect(skin.rect[2]).toBeLessThanOrEqual(19);
  expect(skin.rect[3]).toBeLessThanOrEqual(40);
  g.beam([0.5, 0.3, 0.5], [0.5, 0.7, 0.5], 0.04, skin);
  expect(g.faces.length).toBeGreaterThan(0);
  for (const f of g.faces)
    for (let i = 0; i < f.uvs!.length; i += 2) {
      const x = Math.floor(f.uvs![i] * ref.pageWidth),
        y = Math.floor((1 - f.uvs![i + 1]) * ref.pageHeight);
      expect(base[(y * 96 + x) * 4 + 3]).toBe(255);
    }
});
it("maps adjacent curved segments continuously instead of repeating the texture on each wedge", () => {
  const g = new NativeWorkshopGeometry(object(), {
    width: 96,
    height: 128,
    base: new Uint8ClampedArray(96 * 128 * 4),
  });
  const skin = g.skin([20, 20, 40, 40]);
  g.projected(
    [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    skin,
    [0, 0, 2, 1],
  );
  g.projected(
    [
      [1, 0, 0],
      [1, 1, 0],
      [2, 1, 0],
      [2, 0, 0],
    ],
    skin,
    [0, 0, 2, 1],
  );
  expect(g.faces[0].uvs!.slice(4, 6)).toEqual(g.faces[1].uvs!.slice(2, 4));
  expect(g.faces[0].uvs!.slice(6, 8)).toEqual(g.faces[1].uvs!.slice(0, 2));
});
it("joins bent pipes without internal cap fans or UVs outside the local material", () => {
  const g = new NativeWorkshopGeometry(object(), {
    width: 96,
    height: 128,
    base: new Uint8ClampedArray(96 * 128 * 4),
  });
  const skin = g.skin([8, 43, 12, 47]);
  g.tube(
    [
      [0.2, 0.2, 0.5],
      [0.5, 0.2, 0.5],
      [0.6, 0.3, 0.5],
      [0.6, 0.6, 0.5],
    ],
    0.08,
    skin,
  );
  expect(g.faces.length).toBeGreaterThan(0);
  for (const f of g.faces) {
    expect(f.positions.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < 4; i++) {
      const p = f.positions.slice(i * 3, i * 3 + 3);
      expect(Math.hypot(p[0] - 0.5, p[1] - 0.2, p[2] - 0.5)).toBeGreaterThan(
        1e-6,
      );
      const x = f.uvs![i * 2] * 96,
        y = (1 - f.uvs![i * 2 + 1]) * 128;
      expect(x).toBeGreaterThanOrEqual(8 - 1e-6);
      expect(x).toBeLessThanOrEqual(12 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(43 - 1e-6);
      expect(y).toBeLessThanOrEqual(47 + 1e-6);
    }
  }
});
it("deduplicates artwork and worker jobs while registering the completed layout", async () => {
  const messages: { id: number; sheets: Record<string, unknown> }[] = [];
  let worker: { onmessage?: (e: unknown) => void };
  vi.stubGlobal(
    "Image",
    class {
      width = 96;
      height = 128;
      decode = vi.fn().mockResolvedValue(undefined);
    },
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(96 * 128 * 4) }),
      }),
    }),
  });
  vi.stubGlobal(
    "Worker",
    class {
      onmessage?: (e: unknown) => void;
      constructor() {
        worker = this;
      }
      postMessage(m: (typeof messages)[number]) {
        messages.push(m);
      }
      terminate() {}
    },
  );
  const loader = new NativeWorkshops(),
    o = object("d".repeat(24));
  const first = loader.load(o),
    second = loader.load({ ...o, x: 100 });
  expect(first).toBe(second);
  await vi.waitFor(() => expect(messages).toHaveLength(1));
  expect(Object.keys(messages[0].sheets)).toHaveLength(1);
  worker!.onmessage!({
    data: {
      id: messages[0].id,
      faces: [
        { positions: [0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0], brightness: 1 },
      ],
    },
  });
  expect(await first).toBe(true);
  expect(hasNativeWorkshop(o)).toBe(true);
  expect(await loader.load(o)).toBe(false);
  loader.dispose();
});
it("settles queued geometry jobs when the renderer is disposed", async () => {
  const terminate = vi.fn(),
    posted = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      width = 96;
      height = 128;
      decode = vi.fn().mockResolvedValue(undefined);
    },
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(96 * 128 * 4) }),
      }),
    }),
  });
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = posted;
      terminate = terminate;
    },
  );
  const loader = new NativeWorkshops(),
    o = object("e".repeat(24)),
    pending = loader.load(o);
  await vi.waitFor(() => expect(posted).toHaveBeenCalledOnce());
  loader.dispose();
  expect(await pending).toBe(false);
  expect(terminate).toHaveBeenCalledOnce();
  expect(hasNativeWorkshop(o)).toBe(false);
});
