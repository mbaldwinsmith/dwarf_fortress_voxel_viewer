import * as THREE from "three";
import type { SpriteRef } from "../shared/model.js";
export type TerrainUV = [number, number, number, number];
export function atlasRect(slot: number): TerrainUV {
  const x = (slot % 60) * 34 + 1,
    y = Math.floor(slot / 60) * 34 + 1;
  return [
    (x + 0.5) / 2048,
    1 - (y + 31.5) / 2048,
    (x + 31.5) / 2048,
    1 - (y + 0.5) / 2048,
  ];
}
export class TerrainAtlas {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private slots = new Map<string, number>();
  private images = new Map<string, Promise<HTMLImageElement>>();
  private disposed = false;
  texture: THREE.CanvasTexture;
  constructor() {
    this.canvas.width = this.canvas.height = 2048;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, 2048, 2048);
    this.ctx.imageSmoothingEnabled = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
  }
  private image(asset: string) {
    let p = this.images.get(asset);
    if (!p) {
      p = new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(Error("Local terrain sheet unavailable"));
        image.src = `/local-art/${asset}`;
      });
      this.images.set(asset, p);
    }
    return p;
  }
  uv = (ref?: SpriteRef, transparent = false): TerrainUV => {
    if (!ref) return atlasRect(0);
    const key = JSON.stringify([ref, transparent]);
    let slot = this.slots.get(key);
    if (slot !== undefined) return atlasRect(slot);
    if (this.slots.size >= 1023) return atlasRect(0);
    slot = this.slots.size + 1;
    this.slots.set(key, slot);
    const assigned = slot;
    if (transparent) {
      this.ctx.clearRect(
        (assigned % 60) * 34,
        Math.floor(assigned / 60) * 34,
        34,
        34,
      );
      this.texture.needsUpdate = true;
    }
    void this.image(ref.asset)
      .then((image) => {
        if (this.disposed) return;
        if (image.width !== ref.pageWidth || image.height !== ref.pageHeight)
          throw Error("Terrain sheet dimensions differ from definition");
        const x = (assigned % 60) * 34 + 1,
          y = Math.floor(assigned / 60) * 34 + 1;
        this.ctx.drawImage(
          image,
          ref.x,
          ref.y,
          ref.width,
          ref.height,
          x,
          y,
          32,
          32,
        );
        // Extrude border pixels into the gutter; atlas cells never sample neighbours.
        this.ctx.drawImage(this.canvas, x, y, 32, 1, x, y - 1, 32, 1);
        this.ctx.drawImage(this.canvas, x, y + 31, 32, 1, x, y + 32, 32, 1);
        this.ctx.drawImage(this.canvas, x, y, 1, 32, x - 1, y, 1, 32);
        this.ctx.drawImage(this.canvas, x + 31, y, 1, 32, x + 32, y, 1, 32);
        this.texture.needsUpdate = true;
      })
      .catch((e) =>
        console.warn(
          "Terrain texture unavailable; using flat colour",
          String(e),
        ),
      );
    return atlasRect(slot);
  };
  dispose() {
    this.disposed = true;
    this.texture.dispose();
    this.slots.clear();
    this.images.clear();
  }
}
