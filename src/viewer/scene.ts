import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  LEVELS_ABOVE,
  LEVELS_BELOW,
  affected,
  chunkKey,
  type Bounds,
  type Chunk,
  WorldState,
} from "../shared/model.js";
import { CreatureSprites } from "./creatures.js";
import { ScenerySprites } from "./scenery.js";
import { TerrainAtlas } from "./terrain-atlas.js";
import { buildMesh } from "./mesh.js";
import { FirstPersonControls, canWalk, walkingHeight } from "./first-person.js";
import { LiquidMeshes } from "./liquids.js";
import { FlowSprites } from "./flows.js";
export class FortressScene {
  creatures = new CreatureSprites();
  scenery = new ScenerySprites();
  liquids: LiquidMeshes;
  flows: FlowSprites;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  controls: OrbitControls;
  meshes = new Map<string, THREE.Mesh>();
  dirty = new Set<string>();
  private emptyChunks = new WeakSet<Chunk>();
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
  onNavigationChange?: (mode: "orbit" | "select" | "firstPerson") => void;
  onWalkLevel?: (level: number) => void;
  navigation: "orbit" | "select" | "firstPerson" = "orbit";
  firstPerson: FirstPersonControls;
  private lastFrame = performance.now();
  private lastFocus = "";
  private dragStart?: { x: number; y: number; moved: boolean };
  private orbitPosition = new THREE.Vector3();
  private orbitTarget = new THREE.Vector3();
  private spawn?: { x: number; y: number; z: number };
  private selector = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.88),
    new THREE.MeshBasicMaterial({
      color: 0x62ffe3,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  private selectorBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.95, 0.95)),
    new THREE.LineBasicMaterial({
      color: 0xbaffef,
      transparent: true,
      opacity: 1,
      depthTest: false,
    }),
  );
  constructor(
    public host: HTMLElement,
    public state: WorldState,
    public stats: HTMLElement,
  ) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D fortress terrain. Left drag to pan; right drag to rotate; scroll to zoom.",
    );
    this.scene.add(this.creatures.group);
    this.scene.add(this.scenery.group);
    this.liquids = new LiquidMeshes(
      this.terrainAtlas.texture,
      this.terrainAtlas.uv,
    );
    this.flows = new FlowSprites(
      this.terrainAtlas.texture,
      this.terrainAtlas.uv,
    );
    this.scene.add(this.liquids.group);
    this.scene.add(this.flows.group);
    this.scene.background = new THREE.Color("#101a23");
    this.scene.add(new THREE.HemisphereLight(0xcde2ef, 0x504333, 2));
    const sun = new THREE.DirectionalLight(0xffe4b5, 2.3);
    sun.position.set(-50, 100, 20);
    this.scene.add(sun);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.screenSpacePanning = false;
    this.firstPerson = new FirstPersonControls(
      this.renderer.domElement,
      this.camera,
      () => this.state.chunks,
      () => (this.bounds ? this.bounds.z + this.bounds.height - 1 : Infinity),
    );
    this.firstPerson.onLevelChange = (z) => {
      this.followWalkingCut(z);
      this.onWalkLevel?.(z);
    };
    this.selector.rotation.x = -Math.PI / 2;
    this.selector.add(this.selectorBorder);
    this.selector.visible = false;
    this.scene.add(this.selector);
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
    this.renderer.domElement.addEventListener("pointerdown", this.beginDrag);
    this.renderer.domElement.addEventListener("pointermove", this.hover);
    this.renderer.domElement.addEventListener("pointerleave", this.leave);
    this.camera.position.set(30, 50, 60);
    this.animate();
  }
  private rayHit(e: MouseEvent) {
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
    return ray.intersectObjects([...this.meshes.values()])[0];
  }
  private leave = () => {
    this.selector.visible = false;
    this.spawn = undefined;
  };
  private hover = (e: MouseEvent) => {
    if (
      this.dragStart &&
      Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y) > 4
    )
      this.dragStart.moved = true;
    if (this.navigation !== "select") return;
    this.spawn = undefined;
    const hit = this.rayHit(e);
    this.selector.visible = !!hit;
    if (!hit) return;
    const p = hit.point
      .clone()
      .addScaledVector(hit.face?.normal ?? new THREE.Vector3(), -0.001);
    const x = Math.floor(p.x) + 0.5,
      y = Math.floor(p.z) + 0.5,
      z = this.cut;
    const valid =
      Math.floor(p.y) === z &&
      canWalk(
        this.state.chunks,
        x,
        y,
        z,
        this.bounds ? this.bounds.z + this.bounds.height - 1 : Infinity,
      );
    const h = walkingHeight(this.state.chunks, x, y, z);
    this.selector.position.set(x, valid ? h! + 0.025 : hit.point.y + 0.02, y);
    this.selector.material.color.setHex(valid ? 0x62ffe3 : 0xff6677);
    if (valid) this.spawn = { x, y, z };
  };
  private beginDrag = (e: PointerEvent) => {
    this.dragStart =
      e.button === 0 && this.navigation !== "firstPerson"
        ? { x: e.clientX, y: e.clientY, moved: false }
        : undefined;
  };
  pick = (e: MouseEvent) => {
    const dragged = this.dragStart?.moved;
    this.dragStart = undefined;
    if (e.button !== 0 || dragged) return;
    if (this.navigation === "firstPerson") {
      this.firstPerson.capture();
      return;
    }
    if (this.navigation === "select") {
      this.hover(e);
      if (this.spawn) {
        const { x, y, z } = this.spawn;
        this.orbitPosition.copy(this.camera.position);
        this.orbitTarget.copy(this.controls.target);
        this.controls.enabled = false;
        this.camera.fov = 75;
        this.camera.near = 0.025;
        this.camera.updateProjectionMatrix();
        this.navigation = "firstPerson";
        this.leave();
        this.firstPerson.enter(x, y, z);
        this.refreshRoofs();
        this.onNavigationChange?.(this.navigation);
      }
      return;
    }
    const hit = this.rayHit(e);
    if (hit) {
      const p = hit.point
        .clone()
        .addScaledVector(hit.face?.normal ?? new THREE.Vector3(), -0.001);
      this.onSelect?.(Math.floor(p.x), Math.floor(p.z), Math.floor(p.y));
    }
  };
  setFirstPerson(enabled: boolean) {
    const wasWalking = this.navigation === "firstPerson";
    this.firstPerson.exit();
    if (wasWalking) {
      this.camera.position.copy(this.orbitPosition);
      this.controls.target.copy(this.orbitTarget);
    }
    this.navigation = enabled ? "select" : "orbit";
    this.controls.enabled = true;
    this.camera.fov = 45;
    this.camera.near = 0.1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.leave();
    this.refreshRoofs();
    this.onNavigationChange?.(this.navigation);
  }
  private refreshRoofs() {
    const roofs = [...this.state.chunks.values()];
    if (this.navigation === "firstPerson") {
      const distance = (c: Chunk) =>
        Math.hypot(
          c.x + 8 - this.camera.position.x,
          c.y + 8 - this.camera.position.z,
        );
      roofs.sort((a, b) => distance(a) - distance(b));
      this.dirty = new Set([...roofs.map(chunkKey), ...this.dirty]);
    } else {
      // Restore the orbit cutaway and native stair sprites.
      for (const c of roofs) {
        const k = chunkKey(c),
          mesh = this.meshes.get(k);
        if (mesh && c.z > this.cut) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.meshes.delete(k);
        }
      }
      this.update(roofs);
    }
  }
  private followWalkingCut(z: number) {
    if (z === this.cut) return;
    const old = this.cut;
    this.cut = z;
    this.updateVisibility(old);
  }
  private updateVisibility(oldCut: number) {
    const firstPerson = this.navigation === "firstPerson";
    const top = this.cut + (firstPerson ? LEVELS_ABOVE : 0);
    const oldTop = oldCut + (firstPerson ? LEVELS_ABOVE : 0);
    for (const [k, c] of this.state.chunks) {
      const mesh = this.meshes.get(k);
      if (mesh) mesh.visible = c.z <= top && c.z >= this.cut - LEVELS_BELOW;
      if (
        (oldCut !== this.cut && (c.z === oldTop || c.z === top)) ||
        ((!mesh || mesh.userData.stale) &&
          !this.emptyChunks.has(c) &&
          c.z <= top &&
          c.z >= this.cut - LEVELS_BELOW)
      )
        this.dirty.add(k);
    }
  }
  changeView(bounds: Bounds, level: number, keepWalking: boolean) {
    if (this.navigation === "firstPerson" && !keepWalking)
      this.setFirstPerson(true);
    const old = this.cut;
    if (!keepWalking) {
      this.camera.position.y += level - old;
      this.controls.target.y += level - old;
    }
    this.bounds = bounds;
    this.cut = level;
    for (const [k, mesh] of this.meshes) {
      if (!this.state.chunks.has(k)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.meshes.delete(k);
        this.dirty.delete(k);
      }
    }
    this.scenery.prune(this.state.chunks);
    this.liquids.prune(this.state.chunks);
    this.flows.prune(this.state.chunks);
    this.updateVisibility(old);
  }
  reset(
    bounds: Bounds,
    level = bounds.z + bounds.height - 1,
    keepWalking = false,
  ) {
    if (this.navigation === "firstPerson" && !keepWalking)
      this.setFirstPerson(true);
    this.leave();
    this.creatures.clear();
    this.scenery.clear();
    this.liquids.clear();
    this.flows.clear();
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
    if (keepWalking) {
      this.firstPerson.waitingForTerrain = false;
      return;
    }
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
    if (this.navigation === "firstPerson") return;
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
    this.flows.update(chunks);
    for (const c of chunks) for (const k of affected(c)) this.dirty.add(k);
  }
  setCut(z: number) {
    if (this.navigation === "firstPerson") this.setFirstPerson(true);
    const delta = z - this.cut;
    this.camera.position.y += delta;
    this.controls.target.y += delta;
    const old = this.cut;
    this.cut = z;
    this.updateVisibility(old);
  }
  animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const start = performance.now();
    this.firstPerson.update((start - this.lastFrame) / 1000);
    if (this.navigation === "firstPerson") {
      const focus = `${Math.floor(this.camera.position.x / 16)},${Math.floor(this.camera.position.z / 16)}`;
      if (focus !== this.lastFocus) {
        this.lastFocus = focus;
        this.onWalkLevel?.(this.cut);
      }
    }
    this.lastFrame = start;
    if (this.selector.visible)
      this.selector.material.opacity = 0.3 + Math.sin(start / 180) * 0.12;
    let count = 0;
    for (const k of this.dirty) {
      if (count >= 3 || performance.now() - start > 8) break;
      this.dirty.delete(k);
      const c = this.state.chunks.get(k);
      if (!c) continue;
      // Pure air cannot gain geometry through neighbour changes. Do not spend
      // the mesh budget rebuilding the same sky after every z-level step.
      if (this.emptyChunks.has(c)) continue;
      if (
        c.z >
          this.cut + (this.navigation === "firstPerson" ? LEVELS_ABOVE : 0) ||
        c.z < this.cut - LEVELS_BELOW
      ) {
        const hidden = this.meshes.get(k);
        if (hidden) hidden.userData.stale = true;
        continue;
      }
      count++;
      const old = this.meshes.get(k);
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
        this.meshes.delete(k);
      }
      this.scenery.update(
        [c],
        this.state.chunks,
        this.navigation === "firstPerson",
      );
      this.liquids.update(
        [c],
        this.state.chunks,
        this.cut + (this.navigation === "firstPerson" ? LEVELS_ABOVE : 0),
      );
      const data = buildMesh(
        c,
        this.state.chunks,
        this.cut,
        this.terrainAtlas.uv,
        this.navigation === "firstPerson",
      );
      if (
        !c.objects?.length &&
        c.tiles.every((t) => t.shape === "empty" && !t.liquid && !t.treeGraphic)
      )
        this.emptyChunks.add(c);
      if (!data.positions.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3),
      );
      g.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
      const m = new THREE.Mesh(g, this.material);
      this.meshes.set(k, m);
      this.scene.add(m);
    }
    const visibleLevel =
      this.navigation === "firstPerson" ? this.cut + LEVELS_ABOVE : this.cut;
    this.creatures.update(
      this.state.chunks,
      visibleLevel,
      this.cut - LEVELS_BELOW,
    );
    if (this.navigation !== "firstPerson") this.controls.update();
    this.scenery.frame(this.camera, visibleLevel, this.cut - LEVELS_BELOW);
    this.liquids.frame(start, visibleLevel, this.cut - LEVELS_BELOW);
    this.flows.frame(
      this.camera,
      this.state.chunks,
      start,
      visibleLevel,
      this.cut - LEVELS_BELOW,
    );
    this.renderer.render(this.scene, this.camera);
    this.stats.textContent = `${this.state.chunks.size} blocks · ${this.creatures.visibleCount} creatures · ${this.scenery.visibleCount} furnishings/plants/items · ${this.renderer.info.render.triangles.toLocaleString()} triangles · ${this.dirty.size} queued`;
  };
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener("click", this.pick);
    this.renderer.domElement.removeEventListener("pointerdown", this.beginDrag);
    this.renderer.domElement.removeEventListener("pointermove", this.hover);
    this.renderer.domElement.removeEventListener("pointerleave", this.leave);
    this.firstPerson.dispose();
    this.selector.geometry.dispose();
    this.selector.material.dispose();
    this.selectorBorder.geometry.dispose();
    this.selectorBorder.material.dispose();
    this.controls.dispose();
    this.creatures.dispose();
    this.scenery.dispose();
    this.liquids.dispose();
    this.flows.dispose();
    for (const m of this.meshes.values()) m.geometry.dispose();
    this.material.dispose();
    this.terrainAtlas.dispose();
    this.renderer.dispose();
  }
}
