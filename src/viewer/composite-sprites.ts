import * as THREE from "three";
import type { SpriteLayer } from "../shared/model.js";
export function compositionBounds(layers: SpriteLayer[]) {
  const width = Math.max(32, ...layers.map((l) => l.sprite.width));
  const height = Math.max(32, ...layers.map((l) => l.sprite.height));
  return { width, height, minY: 32 - height, footFromBottom: 0 };
}
export function recolor(
  pixels: Uint8ClampedArray,
  source: Uint8ClampedArray | undefined,
  target: Uint8ClampedArray | undefined,
  tint?: number[],
) {
  const palette = new Map<number, number[]>();
  if (source && target)
    for (let i = 0; i < Math.min(source.length, target.length); i += 4)
      palette.set((source[i] << 16) | (source[i + 1] << 8) | source[i + 2], [
        target[i],
        target[i + 1],
        target[i + 2],
      ]);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const rgb = palette.get(
      (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2],
    );
    if (rgb) pixels.set(rgb, i);
    if (tint) {
      const light = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) / 255;
      pixels[i] = tint[0] * light;
      pixels[i + 1] = tint[1] * light;
      pixels[i + 2] = tint[2] * light;
    }
  }
}
export class CompositeSprites {
  private images = new Map<string, Promise<HTMLImageElement>>();
  private entries = new Map<
    string,
    { material: THREE.SpriteMaterial; texture?: THREE.Texture }
  >();
  private disposed = false;
  private warnedCapacity = false;
  private image(asset: string) {
    let pending = this.images.get(asset);
    if (!pending) {
      pending = new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(Error("Local layer image unavailable"));
        image.src = `/local-art/${asset}`;
      });
      this.images.set(asset, pending);
    }
    return pending;
  }
  material(layers: SpriteLayer[], fallback: THREE.SpriteMaterial) {
    const key = JSON.stringify(layers),
      existing = this.entries.get(key);
    if (existing) return existing.material;
    // At capacity show markers rather than allocate unbounded equipment combinations.
    if (this.entries.size >= 256) {
      if (!this.warnedCapacity) {
        console.warn(
          "Layered appearance cache full; additional appearances use markers until reload",
        );
        this.warnedCapacity = true;
      }
      return fallback;
    }
    const entry: { material: THREE.SpriteMaterial; texture?: THREE.Texture } = {
      material: fallback.clone(),
    };
    this.entries.set(key, entry);
    void this.compose(layers)
      .then((canvas) => {
        if (this.disposed) return;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        entry.texture = texture;
        entry.material.map = texture;
        entry.material.needsUpdate = true;
      })
      .catch((e) =>
        console.warn("Layered sprite unavailable; using marker", String(e)),
      );
    return entry.material;
  }
  private async compose(layers: SpriteLayer[]) {
    await Promise.all(
      layers.flatMap((l) => [
        this.image(l.sprite.asset),
        ...(l.palette ? [this.image(l.palette.asset)] : []),
      ]),
    );
    const { width, height, minY } = compositionBounds(layers);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    for (const l of layers) {
      const r = l.sprite,
        image = await this.image(r.asset);
      if (image.width !== r.pageWidth || image.height !== r.pageHeight)
        throw Error("Layer image dimensions differ from definition");
      const tile = document.createElement("canvas");
      tile.width = r.width;
      tile.height = r.height;
      const t = tile.getContext("2d")!;
      t.drawImage(image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
      let source: Uint8ClampedArray | undefined,
        target: Uint8ClampedArray | undefined;
      if (l.palette) {
        const p = l.palette,
          img = await this.image(p.asset);
        if (p.row >= img.height || p.sourceRow >= img.height)
          throw Error("Palette row out of bounds");
        const pc = document.createElement("canvas");
        pc.width = img.width;
        pc.height = img.height;
        const context = pc.getContext("2d")!;
        context.drawImage(img, 0, 0);
        source = context.getImageData(0, p.sourceRow, img.width, 1).data;
        target = context.getImageData(0, p.row, img.width, 1).data;
      }
      const data = t.getImageData(0, 0, r.width, r.height);
      recolor(data.data, source, target, l.tint);
      t.putImageData(data, 0, 0);
      // Large sprites extend left/up from the normal tile, anchored bottom-right.
      ctx.drawImage(tile, width - r.width, 32 - r.height - minY);
    }
    return canvas;
  }
  dispose() {
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.texture?.dispose();
      e.material.dispose();
    }
    this.entries.clear();
    this.images.clear();
  }
}
