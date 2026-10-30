import type { SceneryObject, SpriteRef } from "../shared/model.js";
import { nativeWorkshopRelief } from "./native-workshop-relief.js";
export interface WorkshopSheet {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}
export interface WorkshopJob {
  id: number;
  object: SceneryObject;
  sheets: Record<string, WorkshopSheet>;
}
const sheets = new Map<string, WorkshopSheet>();
const backgrounds = new Map<string, Uint8ClampedArray>();
function crop(r: SpriteRef) {
  const s = sheets.get(r.asset)!;
  if (
    !s ||
    r.x < 0 ||
    r.y < 0 ||
    r.x + r.width > s.width ||
    r.y + r.height > s.height
  )
    throw Error("Workshop artwork outside local sheet");
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  for (let y = 0; y < r.height; y++) {
    const start = ((r.y + y) * s.width + r.x) * 4;
    out.set(s.pixels.subarray(start, start + r.width * 4), y * r.width * 4);
  }
  return out;
}
function background(r: SpriteRef) {
  const key = JSON.stringify([r.asset, r.width, r.height]);
  const old = backgrounds.get(key);
  if (old) return old;
  const s = sheets.get(r.asset)!;
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  const values = new Uint32Array(
    s.pixels.buffer,
    s.pixels.byteOffset,
    s.pixels.length / 4,
  );
  const dest = new Uint32Array(out.buffer);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const counts = new Map<number, number>();
      let best = 0,
        count = 0;
      for (let Y = y; Y < s.height; Y += r.height) {
        const v = values[Y * s.width + x],
          n = (counts.get(v) ?? 0) + 1;
        counts.set(v, n);
        if (n > count) {
          best = v;
          count = n;
        }
      }
      dest[y * r.width + x] = best;
    }
  backgrounds.set(key, out);
  if (backgrounds.size > 24)
    backgrounds.delete(backgrounds.keys().next().value!);
  return out;
}
self.onmessage = ({ data }: MessageEvent<WorkshopJob>) => {
  try {
    for (const [key, value] of Object.entries(data.sheets))
      sheets.set(key, value);
    const o = data.object,
      w = o.workshop!,
      a = w.art!;
    const faces = nativeWorkshopRelief(o, {
      width: a.base.width,
      height: a.base.height,
      base: crop(a.base),
      ...(a.decor ? { decor: crop(a.decor) } : {}),
      ...(w.width > 1 ? { background: background(a.base) } : {}),
    });
    self.postMessage({ id: data.id, faces });
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error) });
  }
};
