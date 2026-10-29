import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  affected,
  type Bounds,
  type Chunk,
  WorldState,
} from "../shared/model.js";
import { CreatureSprites } from "./creatures.js";
import { ScenerySprites } from "./scenery.js";
import { TerrainAtlas } from "./terrain-atlas.js";
import { buildMesh } from "./mesh.js";
export class FortressScene {
  creatures = new CreatureSprites();
  scenery = new ScenerySprites();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  controls: OrbitControls;
  meshes = new Map<string, THREE.Mesh>();
  dirty = new Set<string>();
  cut = 0;
  bounds?: Bounds;
  terrainAtlas = new TerrainAtlas();
  material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    map: this.terrainAtlas.texture,
    alphaTest: 0.3,
  });
  observer: ResizeObserver;
  frameId = 0;
  onSelect?: (x: number, y: number, z: number) => void;
  constructor(
    public host: HTMLElement,
    public state: WorldState,
    public stats: HTMLElement,
  ) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D fortress terrain. Drag to orbit; right drag to pan; scroll to zoom.",
    );
    this.scene.add(this.creatures.group);
    this.scene.add(this.scenery.group);
    this.scene.background = new THREE.Color("#101a23");
    this.scene.add(new THREE.HemisphereLight(0xcde2ef, 0x504333, 2));
    const sun = new THREE.DirectionalLight(0xffe4b5, 2.3);
    sun.position.set(-50, 100, 20);
    this.scene.add(sun);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.observer = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.observer.observe(host);
    this.renderer.domElement.addEventListener("click", this.pick);
    this.camera.position.set(30, 50, 60);
    this.animate();
  }
  pick = (e: MouseEvent) => {
    if (!this.bounds) return;
    const r = this.renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObjects([...this.meshes.values()])[0];
    if (hit) {
      const p = hit.point
        .clone()
        .addScaledVector(hit.face?.normal ?? new THREE.Vector3(), -0.001);
      this.onSelect?.(Math.floor(p.x), Math.floor(p.z), Math.floor(p.y));
    }
  };
  reset(bounds: Bounds, level = bounds.z + bounds.height - 1) {
    this.creatures.clear();
    this.scenery.clear();
    const preserve =
      this.bounds?.width === bounds.width &&
      this.bounds?.depth === bounds.depth &&
      bounds.height > 0;
    const delta = level - this.cut;
    const dx = bounds.x - (this.bounds?.x ?? bounds.x),
      dy = bounds.y - (this.bounds?.y ?? bounds.y);
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.dirty.clear();
    this.bounds = bounds;
    this.cut = level;
    if (preserve) {
      this.camera.position.x += dx;
      this.controls.target.x += dx;
      this.camera.position.z += dy;
      this.controls.target.z += dy;
      this.camera.position.y += delta;
      this.controls.target.y += delta;
    } else if (bounds.height) this.frame();
  }
  frame() {
    if (!this.bounds) return;
    const b = this.bounds,
      t = new THREE.Vector3(b.x + b.width / 2, this.cut - 1, b.y + b.depth / 2);
    this.controls.target.copy(t);
    this.camera.position
      .copy(t)
      .add(
        new THREE.Vector3(
          b.width * 0.9,
          Math.max(b.width, b.depth) * 1.05,
          b.depth * 0.95,
        ),
      );
    this.controls.update();
  }
  update(chunks: Chunk[]) {
    for (const c of chunks) for (const k of affected(c)) this.dirty.add(k);
  }
  setCut(z: number) {
    const delta = z - this.cut;
    this.camera.position.y += delta;
    this.controls.target.y += delta;
    this.cut = z;
    for (const k of this.state.chunks.keys()) this.dirty.add(k);
  }
  animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const start = performance.now();
    let count = 0;
    for (const k of this.dirty) {
      if (count++ >= 3 || performance.now() - start > 8) break;
      this.dirty.delete(k);
      const old = this.meshes.get(k);
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
        this.meshes.delete(k);
      }
      const c = this.state.chunks.get(k);
      if (!c) continue;
      this.scenery.update([c], this.state.chunks);
      const data = buildMesh(
        c,
        this.state.chunks,
        this.cut,
        this.terrainAtlas.uv,
      );
      if (!data.positions.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3),
      );
      g.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.material);
      this.meshes.set(k, m);
      this.scene.add(m);
    }
    this.creatures.update(this.state.chunks, this.cut);
    this.controls.update();
    this.scenery.frame(this.camera, this.cut);
    this.renderer.render(this.scene, this.camera);
    this.stats.textContent = `${this.state.chunks.size} blocks · ${this.creatures.visibleCount} creatures · ${this.scenery.visibleCount} furnishings/plants/items · ${this.renderer.info.render.triangles.toLocaleString()} triangles · ${this.dirty.size} queued`;
  };
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener("click", this.pick);
    this.controls.dispose();
    this.creatures.dispose();
    this.scenery.dispose();
    for (const m of this.meshes.values()) m.geometry.dispose();
    this.material.dispose();
    this.terrainAtlas.dispose();
    this.renderer.dispose();
  }
}
