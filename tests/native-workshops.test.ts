import { afterEach, expect, it, vi } from "vitest";
import type { SceneryObject, SpriteRef } from "../src/shared/model.js";
import { nativeWorkshopRelief } from "../src/viewer/native-workshop-relief.js";
import { NativeWorkshops } from "../src/viewer/native-workshops.js";
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
