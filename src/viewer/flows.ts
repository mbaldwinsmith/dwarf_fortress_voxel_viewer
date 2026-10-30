import * as THREE from "three";
import {
  chunkKey,
  tileAt,
  type Chunk,
  type FlowEffect,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
const MAX_PARTICLES = 1536;
export function particleCount(flow: FlowEffect) {
  return Math.max(1, Math.min(8, Math.ceil(flow.density / 14)));
}
function batch(map: THREE.Texture, opacity: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 18), 3).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 12), 2).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity,
    alphaTest: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}
export class FlowSprites {
  group = new THREE.Group();
  visibleCount = 0;
  private blocks = new Map<string, FlowEffect[]>();
  private smoke: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private fire: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  constructor(
    map: THREE.Texture,
    private uv: (ref?: SpriteRef, transparent?: boolean) => TerrainUV,
  ) {
    this.smoke = batch(map, 0.62);
    this.fire = batch(map, 0.92);
    this.group.add(this.smoke, this.fire);
  }
  update(chunks: Chunk[]) {
    for (const c of chunks) {
      if (c.flows?.length) this.blocks.set(chunkKey(c), c.flows);
      else this.blocks.delete(chunkKey(c));
    }
  }
  prune(chunks: Map<string, Chunk>) {
    for (const key of this.blocks.keys())
      if (!chunks.has(key)) this.blocks.delete(key);
  }
  frame(
    camera: THREE.Camera,
    all: Map<string, Chunk>,
    time: number,
    top: number,
    min: number,
  ) {
    const counts = [0, 0];
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    this.visibleCount = 0;
    for (const flows of this.blocks.values())
      for (const flow of flows) {
        if (
          flow.z > top ||
          flow.z < min ||
          tileAt(all, flow.x, flow.y, flow.z)?.shape === "unknown"
        )
          continue;
        const fiery = /fire/.test(flow.kind),
          index = fiery ? 1 : 0;
        const mesh = fiery ? this.fire : this.smoke;
        const position = mesh.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const texcoord = mesh.geometry.getAttribute(
          "uv",
        ) as THREE.BufferAttribute;
        const frames = flow.frames;
        if (!frames?.length) continue;
        this.visibleCount++;
        const seed =
          (Math.imul(flow.x, 73856093) ^
            Math.imul(flow.y, 19349663) ^
            Math.imul(flow.z, 83492791)) >>>
          0;
        for (
          let i = 0;
          i < particleCount(flow) && counts[index] < MAX_PARTICLES;
          i++
        ) {
          const phase =
            (time / (fiery ? 950 : 2200) +
              i / particleCount(flow) +
              (seed % 97) / 97) %
            1;
          const angle = i * 2.4 + (seed % 6);
          const spread = fiery ? 0.16 : 0.33;
          const cx = flow.x + 0.5 + Math.cos(angle) * spread * phase;
          const cy = flow.z + 0.17 + phase * (fiery ? 0.68 : 0.9);
          const cz = flow.y + 0.5 + Math.sin(angle) * spread * phase;
          const scale =
            (fiery ? 0.5 : 0.8) *
            Math.sin(phase * Math.PI) *
            (0.55 + flow.density / 200);
          const [l, b, r, t] = this.uv(
            frames[Math.floor(time / 150 + i) % frames.length],
            true,
          );
          const corners = [
              [-0.5, -0.5],
              [0.5, -0.5],
              [0.5, 0.5],
              [-0.5, 0.5],
            ],
            uvs = [
              [l, b],
              [r, b],
              [r, t],
              [l, t],
            ];
          const base = counts[index]++ * 6;
          for (const [n, c] of [0, 1, 2, 0, 2, 3].entries()) {
            const [x, y] = corners[c];
            position.setXYZ(
              base + n,
              cx + (right.x * x + up.x * y) * scale,
              cy + (right.y * x + up.y * y) * scale,
              cz + (right.z * x + up.z * y) * scale,
            );
            texcoord.setXY(base + n, ...(uvs[c] as [number, number]));
          }
        }
      }
    for (const [i, mesh] of [this.smoke, this.fire].entries()) {
      mesh.geometry.setDrawRange(0, counts[i] * 6);
      mesh.visible = counts[i] > 0;
      if (!mesh.visible) continue;
      mesh.geometry.getAttribute("position").needsUpdate = true;
      mesh.geometry.getAttribute("uv").needsUpdate = true;
    }
  }
  clear() {
    this.blocks.clear();
    this.visibleCount = 0;
    this.smoke.geometry.setDrawRange(0, 0);
    this.fire.geometry.setDrawRange(0, 0);
  }
  dispose() {
    this.clear();
    for (const mesh of [this.smoke, this.fire]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
