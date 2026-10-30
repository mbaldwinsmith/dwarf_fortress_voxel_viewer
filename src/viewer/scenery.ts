import * as THREE from "three";
import { linearMaterialColor } from "./mesh.js";
import { recolor } from "./composite-sprites.js";
import { SpriteFeet } from "./sprite-ground.js";
import { surfaceHeight } from "./traversal.js";
import {
  LEVELS_BELOW,
  chunkKey,
  tileAt,
  type Chunk,
  type SceneryObject,
  type SpriteRef,
} from "../shared/model.js";
export function objectQuad(o: SceneryObject, axisZ = false) {
  const x = o.x,
    y = o.z + 0.135 + (o.id.startsWith("i:") ? 0.015 : 0),
    z = o.y;
  if (o.kind === "ground")
    return [x, y, z, x, y, z + 1, x + 1, y, z + 1, x + 1, y, z];
  if (axisZ)
    return [
      x + 0.5,
      y + 1,
      z,
      x + 0.5,
      y,
      z,
      x + 0.5,
      y,
      z + 1,
      x + 0.5,
      y + 1,
      z + 1,
    ];
  return [
    x,
    y + 1,
    z + 0.5,
    x,
    y,
    z + 0.5,
    x + 1,
    y,
    z + 0.5,
    x + 1,
    y + 1,
    z + 0.5,
  ];
}
const uv = (r: SpriteRef) => {
  const l = r.x / r.pageWidth,
    right = (r.x + r.width) / r.pageWidth,
    top = 1 - r.y / r.pageHeight,
    bottom = 1 - (r.y + r.height) / r.pageHeight;
  return [l, top, l, bottom, right, bottom, right, top];
};
export class ScenerySprites {
  group = new THREE.Group();
  visibleCount = 0;
  private blocks = new Map<string, THREE.Group>();
  private sheets = new Map<string, THREE.Texture>();
  private materials = new Map<string, THREE.MeshBasicMaterial>();
  private billboards = new Set<THREE.Mesh>();
  private marker: THREE.DataTexture;
  private disposed = false;
  private feet = new SpriteFeet();
  constructor() {
    // Original neutral footprint used only for unsupported building artwork.
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const edge = x === 1 || x === 14 || y === 1 || y === 14;
        pixels.set(
          [
            edge ? 190 : 92,
            edge ? 154 : 78,
            edge ? 102 : 57,
            x === 0 || y === 0 || x === 15 || y === 15 ? 0 : 255,
          ],
          (y * 16 + x) * 4,
        );
      }
    this.marker = new THREE.DataTexture(pixels, 16, 16);
    this.marker.colorSpace = THREE.SRGBColorSpace;
    this.marker.magFilter = THREE.NearestFilter;
    this.marker.needsUpdate = true;
  }
  private material(
    asset?: string,
    palette?: SceneryObject["palette"],
  ): THREE.MeshBasicMaterial {
    const key = JSON.stringify([asset ?? "marker", palette]);
    let m = this.materials.get(key);
    if (m) return m;
    if (asset && this.materials.size >= 512) return this.material();
    m = new THREE.MeshBasicMaterial({
      vertexColors: true,
      map: this.marker,
      side: THREE.DoubleSide,
      alphaTest: 0.3,
    });
    this.materials.set(key, m);
    if (asset) {
      const texture = new THREE.TextureLoader().load(
        `/local-art/${asset}`,
        async () => {
          if (palette) {
            try {
              const img = await new Promise<HTMLImageElement>(
                (resolve, reject) => {
                  const i = new Image();
                  i.onload = () => resolve(i);
                  i.onerror = reject;
                  i.src = `/local-art/${palette.asset}`;
                },
              );
              if (palette.row >= img.height || palette.sourceRow >= img.height)
                throw Error("Scenery palette row out of bounds");
              const pc = document.createElement("canvas");
              pc.width = img.width;
              pc.height = img.height;
              const p = pc.getContext("2d", { willReadFrequently: true })!;
              p.drawImage(img, 0, 0);
              const canvas = document.createElement("canvas");
              const source = texture.image as HTMLImageElement;
              canvas.width = source.width;
              canvas.height = source.height;
              const c = canvas.getContext("2d", { willReadFrequently: true })!;
              c.drawImage(source, 0, 0);
              const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
              recolor(
                pixels.data,
                p.getImageData(0, palette.sourceRow, img.width, 1).data,
                p.getImageData(0, palette.row, img.width, 1).data,
              );
              c.putImageData(pixels, 0, 0);
              (texture as THREE.Texture).image = canvas;
              texture.needsUpdate = true;
            } catch (e) {
              console.warn("Scenery palette unavailable", String(e));
            }
          }
          if (!this.disposed) {
            m!.map = texture;
            m!.needsUpdate = true;
          }
        },
        undefined,
        () =>
          console.warn(
            "Local scenery sheet unavailable; using footprint",
            asset,
          ),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      this.sheets.set(key, texture);
    }
    return m;
  }
  private remove(key: string) {
    const group = this.blocks.get(key);
    if (!group) return;
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        this.billboards.delete(o);
        o.geometry.dispose();
      }
    });
    this.group.remove(group);
    this.blocks.delete(key);
  }
  update(chunks: Chunk[], all: Map<string, Chunk>, firstPerson = false) {
    for (const chunk of chunks) {
      const key = chunkKey(chunk);
      this.remove(key);
      const group = new THREE.Group();
      group.userData.z = chunk.z;
      group.userData.count = 0;
      const batches = new Map<
        string,
        {
          positions: number[];
          colors: number[];
          uvs: number[];
          indices: number[];
          material: THREE.MeshBasicMaterial;
        }
      >();
      for (const o of chunk.objects ?? []) {
        if (firstPerson && o.id.startsWith("s:")) continue;
        const tile = tileAt(all, o.x, o.y, o.z);
        if (!tile || tile.shape === "unknown") continue;
        group.userData.count++;
        const coords = o.sprite ? uv(o.sprite) : [0, 1, 0, 0, 1, 0, 1, 1];
        if (o.kind === "plant") {
          const material = this.material(o.sprite?.asset);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
              [-0.5, 1, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0],
              3,
            ),
          );
          geometry.setAttribute(
            "uv",
            new THREE.Float32BufferAttribute(coords, 2),
          );
          geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(Array(12).fill(1), 3),
          );
          geometry.setIndex([0, 1, 2, 0, 2, 3]);
          geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, material);
          if (!o.sprite) {
            const positions = geometry.getAttribute("position");
            for (let i = 0; i < 4; i++)
              positions.setY(i, (i === 0 || i === 3 ? 1 : 0) - 1 / 16);
            mesh.userData.anchored = true;
          }
          mesh.position.set(
            o.x + 0.5,
            surfaceHeight(all, o.x + 0.5, o.y + 0.5, o.z) ?? o.z + 0.12,
            o.y + 0.5,
          );
          mesh.userData.name = o.name;
          mesh.userData.sprite = o.sprite;
          this.billboards.add(mesh);
          group.add(mesh);
        } else {
          for (const [layerIndex, layer] of [
            {
              sprite: o.sprite,
              tint: o.tint,
              palette: o.palette,
              brightness: 1.4,
            },
            ...(o.overlay ? [{ sprite: o.overlay }] : []),
            ...(o.details ?? []),
          ].entries()) {
            const ref = layer.sprite;
            const palette = "palette" in layer ? layer.palette : undefined;
            const k = JSON.stringify([ref?.asset ?? "marker", palette]);
            let batch = batches.get(k);
            if (!batch) {
              batch = {
                positions: [],
                colors: [],
                uvs: [],
                indices: [],
                material: this.material(ref?.asset, palette),
              };
              batches.set(k, batch);
            }
            const base = batch.positions.length / 3;
            const wall = (x: number, y: number) =>
              tileAt(all, x, y, o.z)?.shape === "wall";
            const axisZ =
              (wall(o.x, o.y - 1) || wall(o.x, o.y + 1)) &&
              !(wall(o.x - 1, o.y) || wall(o.x + 1, o.y));
            batch.positions.push(
              ...objectQuad(o, axisZ).map((v, i) =>
                i % 3 === 1
                  ? v +
                    layerIndex * 0.003 +
                    (o.id.startsWith("i:") && tile.shape === "ramp" ? 0.5 : 0)
                  : v,
              ),
            );
            batch.uvs.push(...(ref ? uv(ref) : coords));
            const tint = layer.tint
              ? linearMaterialColor(layer.tint).map(
                  (v) => v * (layer.brightness ?? 1),
                )
              : [1, 1, 1];
            for (let vertex = 0; vertex < 4; vertex++)
              batch.colors.push(...tint);
            batch.indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3,
            );
          }
        }
      }
      for (const b of batches.values()) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(b.positions, 3),
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(b.uvs, 2));
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(b.colors, 3),
        );
        geometry.setIndex(b.indices);
        geometry.computeBoundingSphere();
        group.add(new THREE.Mesh(geometry, b.material));
      }
      this.blocks.set(key, group);
      this.group.add(group);
    }
  }
  frame(camera: THREE.Camera, cut: number, minLevel = cut - LEVELS_BELOW) {
    this.visibleCount = 0;
    for (const group of this.blocks.values()) {
      group.visible = group.userData.z <= cut && group.userData.z >= minLevel;
      if (group.visible) this.visibleCount += group.userData.count;
    }
    for (const mesh of this.billboards) {
      if (!mesh.userData.anchored && mesh.userData.sprite) {
        const image = (mesh.material as THREE.MeshBasicMaterial).map?.image;
        if (
          image instanceof HTMLImageElement ||
          image instanceof HTMLCanvasElement
        ) {
          const padding = this.feet.get(image, mesh.userData.sprite);
          const positions = mesh.geometry.getAttribute("position");
          for (let i = 0; i < 4; i++)
            positions.setY(i, (i === 0 || i === 3 ? 1 : 0) - padding);
          positions.needsUpdate = true;
          mesh.geometry.computeBoundingSphere();
          mesh.userData.anchored = true;
          mesh.userData.bottomPadding = padding;
        }
      }
      mesh.quaternion.copy(camera.quaternion);
    }
  }
  clear() {
    for (const key of [...this.blocks.keys()]) this.remove(key);
    this.visibleCount = 0;
  }
  prune(chunks: Map<string, Chunk>) {
    for (const key of this.blocks.keys())
      if (!chunks.has(key)) this.remove(key);
  }
  dispose() {
    this.disposed = true;
    this.clear();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.sheets.values()) t.dispose();
    this.materials.clear();
    this.sheets.clear();
    this.marker.dispose();
  }
}
