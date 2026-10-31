import type { SpriteRef } from "../shared/model.js";

// Match alphaTest=0.3: faint discarded pixels must not become the foot anchor.
export function bottomPadding(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
) {
  for (let y = height - 1; y >= 0; y--)
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3] >= 77)
        return (height - 1 - y) / height;
  return 0;
}
export function topPadding(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
) {
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3] >= 77) return y / height;
  return 0;
}
export function imageVerticalPadding(
  image: CanvasImageSource,
  width: number,
  height: number,
  x = 0,
  y = 0,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return {
    bottom: bottomPadding(pixels, width, height),
    top: topPadding(pixels, width, height),
  };
}
export function imageBottomPadding(
  image: CanvasImageSource,
  width: number,
  height: number,
  x = 0,
  y = 0,
) {
  return imageVerticalPadding(image, width, height, x, y).bottom;
}
export class SpriteFeet {
  private padding = new Map<string, { bottom: number; top: number }>();
  private bounds(image: CanvasImageSource, ref: SpriteRef) {
    const key = JSON.stringify(ref);
    let value = this.padding.get(key);
    if (value === undefined) {
      value = imageVerticalPadding(image, ref.width, ref.height, ref.x, ref.y);
      this.padding.set(key, value);
    }
    return value;
  }
  get(image: CanvasImageSource, ref: SpriteRef) {
    return this.bounds(image, ref).bottom;
  }
  getTop(image: CanvasImageSource, ref: SpriteRef) {
    return this.bounds(image, ref).top;
  }
}
