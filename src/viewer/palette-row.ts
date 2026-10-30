const rows = new WeakMap<HTMLImageElement, Map<number, Uint8ClampedArray>>();
/** Palettes are rows, not full image copies. Keep only rows actually used. */
export function paletteRow(image: HTMLImageElement, row: number) {
  if (!Number.isInteger(row) || row < 0 || row >= image.height)
    throw Error("Palette row out of bounds");
  let cache = rows.get(image);
  if (!cache) {
    cache = new Map();
    rows.set(image, cache);
  }
  let pixels = cache.get(row);
  if (!pixels) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, row, image.width, 1, 0, 0, image.width, 1);
    pixels = context.getImageData(0, 0, image.width, 1).data;
    cache.set(row, pixels);
  }
  return pixels;
}
