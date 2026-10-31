import * as THREE from "three";
import type { SpriteLayer, SpriteRef } from "../shared/model.js";
import { paletteRow } from "./palette-row.js";
import { terrainPalette, terrainTone } from "./terrain-palette.js";
export const ATLAS_WIDTH = 2048,
  ATLAS_HEIGHT = 1024;
export const ATLAS_CAPACITY = 60 * Math.floor(ATLAS_HEIGHT / 34) - 1;
export type TerrainUV = [number, number, number, number];
export function atlasRect(slot: number): TerrainUV {
  const x = (slot % 60) * 34 + 1,
    y = Math.floor(slot / 60) * 34 + 1;
  return [
    (x + 0.5) / ATLAS_WIDTH,
    1 - (y + 31.5) / ATLAS_HEIGHT,
    (x + 31.5) / ATLAS_WIDTH,
    1 - (y + 0.5) / ATLAS_HEIGHT,
  ];
}
export class TerrainAtlas {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private slots = new Map<string, number>();
  private coordinates = new WeakMap<
    SpriteRef,
    Map<string, [TerrainUV?, TerrainUV?]>
  >();
  private styleKeys = new WeakMap<object, string>();
  private white = atlasRect(0);
  private images = new Map<string, Promise<HTMLImageElement>>();
  private disposed = false;
  private warnedCapacity = false;
  pending = 0;
  texture: THREE.CanvasTexture;
  constructor() {
    this.canvas.width = ATLAS_WIDTH;
    this.canvas.height = ATLAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
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
  uv = (
    ref?: SpriteRef,
    transparent = false,
    palette?: SpriteLayer["palette"],
    tone?: SpriteRef,
    darkBacking = false,
  ): TerrainUV => {
    if (!ref) return this.white;
    const mode = Number(transparent);
    const identify = (value?: object) => {
      if (!value) return "";
      let id = this.styleKeys.get(value);
      if (id === undefined) {
        id = JSON.stringify(value);
        this.styleKeys.set(value, id);
      }
      return id;
    };
    const style =
      identify(palette) + "|" + identify(tone) + (darkBacking ? "|dark" : "");
    let styles = this.coordinates.get(ref);
    if (!styles) {
      styles = new Map();
      this.coordinates.set(ref, styles);
    }
    const resolved: [TerrainUV?, TerrainUV?] = styles.get(style) ?? [];
    if (resolved[mode]) return resolved[mode]!;
    styles.set(style, resolved);
    const key = JSON.stringify([ref, transparent, style]);
    let slot = this.slots.get(key);
    if (slot !== undefined) return (resolved[mode] = atlasRect(slot));
    if (this.slots.size >= ATLAS_CAPACITY) {
      if (!this.warnedCapacity) {
        this.warnedCapacity = true;
        console.warn(
          "Terrain atlas full; additional materials use flat colour",
        );
      }
      return (resolved[mode] = this.white);
    }
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
    this.pending++;
    void Promise.all([
      this.image(ref.asset),
      palette ? this.image(palette.asset) : undefined,
      tone ? this.image(tone.asset) : undefined,
    ])
      .then(([image, colors, material]) => {
        if (this.disposed) return;
        if (image.width !== ref.pageWidth || image.height !== ref.pageHeight)
          throw Error("Terrain sheet dimensions differ from definition");
        const x = (assigned % 60) * 34 + 1,
          y = Math.floor(assigned / 60) * 34 + 1;
        if (!transparent && darkBacking) {
          // Native glass has partial alpha. Back solid terrain with the same
          // charcoal as cut rock, rather than whitening it over the atlas clear.
          this.ctx.fillStyle = "#312c34";
          this.ctx.fillRect(x, y, 32, 32);
        }
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
        if (tone && material) {
          if (
            material.width !== tone.pageWidth ||
            material.height !== tone.pageHeight
          )
            throw Error("Material tone sheet dimensions differ");
          const sample = document.createElement("canvas");
          sample.width = sample.height = 32;
          const ctx = sample.getContext("2d", { willReadFrequently: true })!;
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = "#312c34";
          ctx.fillRect(0, 0, 32, 32);
          ctx.drawImage(
            material,
            tone.x,
            tone.y,
            tone.width,
            tone.height,
            0,
            0,
            32,
            32,
          );
          const shades = ctx.getImageData(0, 0, 32, 32).data;
          if (palette && colors)
            terrainPalette(
              shades,
              paletteRow(colors, palette.sourceRow),
              paletteRow(colors, palette.row),
            );
          const pixels = this.ctx.getImageData(x, y, 32, 32);
          terrainTone(pixels.data, shades);
          this.ctx.putImageData(pixels, x, y);
        } else if (palette && colors) {
          const pixels = this.ctx.getImageData(x, y, 32, 32);
          terrainPalette(
            pixels.data,
            paletteRow(colors, palette.sourceRow),
            paletteRow(colors, palette.row),
          );
          this.ctx.putImageData(pixels, x, y);
        }
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
      )
      .finally(() => {
        this.pending--;
      });
    return (resolved[mode] = atlasRect(slot));
  };
  dispose() {
    this.disposed = true;
    this.texture.dispose();
    this.slots.clear();
    this.images.clear();
  }
}
