import * as THREE from "three";
import {
  chunkKey,
  tileAt,
  type Chunk,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";

export function liquidGeometry(
  chunk: Chunk,
  chunks: Map<string, Chunk>,
  kind: "water" | "magma",
  cut = Infinity,
  textureUV: (ref?: SpriteRef) => TerrainUV = () => [0, 0, 1, 1],
  uvs: number[] = [],
) {
  const positions: number[] = [];
  let surface: SpriteRef | undefined;
  const quad = (...v: number[][]) => {
    const [l, b, r, t] = textureUV(surface),
      uv = [
        [l, b],
        [r, b],
        [r, t],
        [l, t],
      ];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...v[i]);
      uvs.push(...uv[i]);
    }
  };
  for (let i = 0; i < 256; i++) {
    const t = chunk.tiles[i];
    if (t.shape === "unknown" || t.liquid?.kind !== kind) continue;
    surface = t.liquid.surface;
    const x = chunk.x + (i % 16),
      y = chunk.y + Math.floor(i / 16),
      z = chunk.z;
    const h = z + t.liquid.depth / 7;
    const above = tileAt(chunks, x, y, z + 1);
    if (t.liquid.depth < 7 || z + 1 > cut || above?.liquid?.kind !== kind)
      quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y]);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = tileAt(chunks, x + dx, y + dy, z);
      if (n?.shape === "wall" || n?.shape === "unknown") continue;
      const low = z + (n?.liquid?.kind === kind ? n.liquid.depth / 7 : 0);
      if (low >= h) continue;
      if (dx === 1)
        quad(
          [x + 1, low, y],
          [x + 1, h, y],
          [x + 1, h, y + 1],
          [x + 1, low, y + 1],
        );
      if (dx === -1)
        quad([x, low, y + 1], [x, h, y + 1], [x, h, y], [x, low, y]);
      if (dy === 1)
        quad(
          [x + 1, low, y + 1],
          [x + 1, h, y + 1],
          [x, h, y + 1],
          [x, low, y + 1],
        );
      if (dy === -1)
        quad([x, low, y], [x, h, y], [x + 1, h, y], [x + 1, low, y]);
    }
  }
  return positions;
}

export class LiquidMeshes {
  group = new THREE.Group();
  private blocks = new Map<string, THREE.Group>();
  private materials: Record<"water" | "magma", THREE.MeshBasicMaterial>;
  constructor(
    map: THREE.Texture,
    private textureUV: (ref?: SpriteRef) => TerrainUV,
  ) {
    this.materials = {
      water: new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
        color: 0xffffff,
      }),
      magma: new THREE.MeshBasicMaterial({
        map,
        side: THREE.DoubleSide,
        color: 0xffffff,
      }),
    };
  }
  update(chunks: Chunk[], all: Map<string, Chunk>, cut: number) {
    for (const c of chunks) {
      const key = chunkKey(c);
      this.remove(key);
      if (!c.tiles.some((t) => t.liquid)) continue;
      const group = new THREE.Group();
      group.userData.z = c.z;
      for (const kind of ["water", "magma"] as const) {
        const uvs: number[] = [];
        const positions = liquidGeometry(
          c,
          all,
          kind,
          cut,
          this.textureUV,
          uvs,
        );
        if (!positions.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        const mesh = new THREE.Mesh(geometry, this.materials[kind]);
        mesh.renderOrder = kind === "water" ? 2 : 0;
        group.add(mesh);
      }
      this.blocks.set(key, group);
      this.group.add(group);
    }
  }
  private remove(key: string) {
    const g = this.blocks.get(key);
    if (!g) return;
    for (const child of g.children) (child as THREE.Mesh).geometry.dispose();
    this.group.remove(g);
    this.blocks.delete(key);
  }
  prune(chunks: Map<string, Chunk>) {
    for (const key of this.blocks.keys())
      if (!chunks.has(key)) this.remove(key);
  }
  frame(_time: number, cut: number, min: number) {
    for (const g of this.blocks.values())
      g.visible = g.userData.z <= cut && g.userData.z >= min;
  }
  clear() {
    for (const key of [...this.blocks.keys()]) this.remove(key);
  }
  dispose() {
    this.clear();
    for (const m of Object.values(this.materials)) m.dispose();
  }
}
