import { RenderScheduler } from "./render-scheduler.js";
import { indexAttributes } from "./indexed-geometry.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  LEVELS_ABOVE,
  LEVELS_BELOW,
  affected,
  chunkKey,
  tileAt,
  type Bounds,
  type Chunk,
  WorldState,
} from "../shared/model.js";
import { ProjectileModels } from "./projectiles.js";
import { CreatureSprites } from "./creatures.js";
import { ScenerySprites } from "./scenery.js";
import { TerrainAtlas } from "./terrain-atlas.js";
import { buildMesh } from "./mesh.js";
import { fungiMaterial } from "./fungi-caps.js";
import { FungiMesher } from "./fungi-mesher.js";
import { TreeMesher } from "./tree-mesher.js";
import { FirstPersonControls, canWalk, walkingHeight } from "./first-person.js";
import { LiquidMeshes } from "./liquids.js";
import { FlowSprites } from "./flows.js";
import { OrbitKeyboard } from "./orbit-keyboard.js";
import {
  MiningHold,
  miningOperation,
  validDesignationRectangle,
  validMiningTile,
  type MiningMode,
  type MiningTarget,
} from "../shared/mining.js";
function disposeTerrain(mesh: THREE.Mesh) {
  mesh.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}
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
  projectiles = new ProjectileModels(this.terrainAtlas);
  private capMaterial = fungiMaterial(this.terrainAtlas.texture);
  private capMesher = new FungiMesher();
  private treeMesher = new TreeMesher();
  material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    map: this.terrainAtlas.texture,
    alphaTest: 0.3,
  });
  observer: ResizeObserver;
  frameId = 0;
  private renderScheduler = new RenderScheduler();
  invalidate = () => this.renderScheduler.invalidate();
  private renderedPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  private renderedRotation = new THREE.Quaternion();
  private renderedProjection = new THREE.Matrix4();
  private atlasVersion = -1;
  private lastStats = -Infinity;
  onSelect?: (x: number, y: number, z: number) => void;
  onNavigationChange?: (mode: "orbit" | "select" | "firstPerson") => void;
  onWalkLevel?: (level: number) => void;
  miningMode: MiningMode = "inspect";
  miningBusy = false;
  onMine?: (target: MiningTarget) => void;
  onMiningPreview?: (preview: {
    target?: MiningTarget;
    progress: number;
    holding: boolean;
    x?: number;
    y?: number;
    rectangle?: { width: number; depth: number; valid: boolean };
  }) => void;
  private miningHold = new MiningHold();
  private miningPressed = false;
  private miningPointer?: { x: number; y: number };
  private rectangle?: {
    start: MiningTarget;
    end: { x: number; y: number };
    height: number;
    pointerId: number;
  };
  private suppressRectangleClick = false;
  private miningOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
    new THREE.LineBasicMaterial({
      color: 0xffdc72,
      transparent: true,
      opacity: 0.8,
    }),
  );
  navigation: "orbit" | "select" | "firstPerson" = "orbit";
  firstPerson: FirstPersonControls;
  private orbitKeyboard: OrbitKeyboard;
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
    for (const event of ["pointermove", "pointerdown", "pointerleave"])
      this.renderer.domElement.addEventListener(event, this.invalidate);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D fortress terrain. WASD or left drag to pan; Q/E or right drag to rotate; scroll to zoom.",
    );
    this.scene.add(this.creatures.group, this.projectiles.group);
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
    this.orbitKeyboard = new OrbitKeyboard(
      this.camera,
      this.controls.target,
      () => this.navigation === "orbit" && this.controls.enabled,
    );
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
      this.invalidate();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.observer.observe(host);
    this.renderer.domElement.addEventListener("click", this.pick);
    this.renderer.domElement.addEventListener("pointerdown", this.beginDrag);
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.rectangleDown,
      true,
    );
    this.renderer.domElement.addEventListener("pointermove", this.hover);
    this.renderer.domElement.addEventListener("pointerleave", this.leave);
    this.renderer.domElement.addEventListener("pointerdown", this.miningDown);
    this.renderer.domElement.addEventListener("pointermove", this.miningMove);
    this.renderer.domElement.addEventListener("pointerleave", this.miningLeave);
    window.addEventListener("pointerup", this.cancelMining);
    window.addEventListener("pointerup", this.rectangleUp, true);
    window.addEventListener("pointercancel", this.cancelMining);
    window.addEventListener("blur", this.cancelMining);
    this.miningOutline.visible = false;
    this.scene.add(this.miningOutline);
    this.camera.position.set(30, 50, 60);
    this.animate();
  }
  private rayHit(e: { clientX: number; clientY: number }) {
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
    return ray.intersectObjects(
      [...this.meshes.values()].filter((m) => m.visible),
    )[0];
  }
  cancelMining = () => {
    this.miningPressed = false;
    this.miningHold.cancel();
    this.rectangle = undefined;
  };
  private rectangleDown = (e: PointerEvent) => {
    this.suppressRectangleClick = false;
    if (e.button !== 0) {
      this.rectangle = undefined;
      return;
    }
    if (this.navigation !== "orbit" || this.miningMode !== "designate") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.cancelMining();
    this.dragStart = undefined;
    this.suppressRectangleClick = true;
    if (this.miningBusy) return;
    this.renderer.domElement.focus({ preventScroll: true });
    const preview = this.miningTarget({ x: e.clientX, y: e.clientY });
    if (!preview) return;
    const t = tileAt(
      this.state.chunks,
      preview.target.x,
      preview.target.y,
      preview.target.z,
    );
    this.rectangle = {
      start: preview.target,
      end: { x: preview.target.x, y: preview.target.y },
      height: preview.target.z + (t?.shape === "wall" ? 1 : 0.12),
      pointerId: e.pointerId,
    };
    this.miningPointer = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private updateRectangle(pointer: { x: number; y: number }) {
    const selection = this.rectangle;
    if (!selection || !this.bounds) return;
    const hit = this.rayHit({ clientX: pointer.x, clientY: pointer.y });
    let position: THREE.Vector3 | undefined;
    if (hit) {
      const p = hit.point
        .clone()
        .addScaledVector(hit.face?.normal ?? new THREE.Vector3(), -0.002);
      if (Math.floor(p.y) === selection.start.z) position = p;
    }
    if (!position) {
      const rect = this.renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((pointer.x - rect.left) / rect.width) * 2 - 1,
          1 - ((pointer.y - rect.top) / rect.height) * 2,
        ),
        this.camera,
      );
      position =
        ray.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -selection.height),
          new THREE.Vector3(),
        ) ?? undefined;
    }
    if (position)
      selection.end = {
        x: THREE.MathUtils.clamp(
          Math.floor(position.x),
          this.bounds.x,
          this.bounds.x + this.bounds.width - 1,
        ),
        y: THREE.MathUtils.clamp(
          Math.floor(position.z),
          this.bounds.y,
          this.bounds.y + this.bounds.depth - 1,
        ),
      };
  }
  private rectangleUp = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      !this.rectangle ||
      e.pointerId !== this.rectangle.pointerId
    )
      return;
    this.updateRectangle({ x: e.clientX, y: e.clientY });
    const r = this.rectangle,
      target = { ...r.start, x2: r.end.x, y2: r.end.y };
    this.rectangle = undefined;
    if (
      this.navigation === "orbit" &&
      this.miningMode === "designate" &&
      !this.miningBusy &&
      validDesignationRectangle(target)
    )
      this.onMine?.(target);
  };
  private miningMove = (e: PointerEvent) => {
    this.miningPointer = { x: e.clientX, y: e.clientY };
  };
  private miningLeave = () => {
    if (this.rectangle) return;
    this.miningPointer = undefined;
    if (!this.firstPerson.locked) this.cancelMining();
  };
  private miningDown = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      this.miningMode !== "dig" ||
      this.navigation !== "firstPerson" ||
      this.miningBusy
    )
      return;
    if (!this.firstPerson.active) {
      this.firstPerson.capture();
      return;
    }
    const preview = this.miningTarget();
    if (preview) {
      this.miningPressed = true;
      this.miningHold.begin(preview.target, performance.now());
    }
  };
  private miningTarget(pointer?: { x: number; y: number }) {
    if (this.miningMode === "inspect" || this.navigation === "select") return;
    const firstPerson = this.navigation === "firstPerson",
      rect = this.renderer.domElement.getBoundingClientRect();
    if (firstPerson && !this.firstPerson.active) return;
    const mouse = pointer ?? this.miningPointer;
    if (!firstPerson && !mouse) return;
    const sx = firstPerson ? rect.width / 2 : mouse!.x - rect.left,
      sy = firstPerson ? rect.height / 2 : mouse!.y - rect.top;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2((sx / rect.width) * 2 - 1, 1 - (sy / rect.height) * 2),
      this.camera,
    );
    let meshes: THREE.Mesh[];
    if (firstPerson) {
      ray.far = 5;
      meshes = [];
      const p = this.camera.position;
      for (let x = Math.floor((p.x - 5) / 16) * 16; x <= p.x + 5; x += 16)
        for (let y = Math.floor((p.z - 5) / 16) * 16; y <= p.z + 5; y += 16)
          for (let z = Math.floor(p.y - 5); z <= p.y + 5; z++) {
            const mesh = this.meshes.get(`${x},${y},${z}`);
            if (mesh?.visible) meshes.push(mesh);
          }
    } else meshes = [...this.meshes.values()].filter((m) => m.visible);
    const hit = ray.intersectObjects(meshes)[0];
    // Stairs have gaps between their narrow treads. Pick their tile volume so
    // aiming through a gap removes the stairs instead of channeling below.
    let stair: MiningTarget | undefined,
      nearest = Math.min(hit?.distance ?? Infinity, ray.far);
    const volume = new THREE.Box3(),
      point = new THREE.Vector3();
    for (const mesh of meshes) {
      const c = this.state.chunks.get(mesh.userData.chunkKey);
      if (!c) continue;
      volume.min.set(c.x, c.z, c.y);
      volume.max.set(c.x + 16, c.z + 1, c.y + 16);
      if (!ray.ray.intersectsBox(volume)) continue;
      for (let i = 0; i < c.tiles.length; i++) {
        if (c.tiles[i].shape !== "stairs") continue;
        const x = c.x + (i % 16),
          y = c.y + Math.floor(i / 16);
        volume.min.set(x, c.z, y);
        volume.max.set(x + 1, c.z + 1, y + 1);
        if (!ray.ray.intersectBox(volume, point)) continue;
        const distance = point.distanceTo(ray.ray.origin);
        if (distance < ray.near || distance >= nearest) continue;
        const target: MiningTarget = {
          x,
          y,
          z: c.z,
          operation: "remove-stairs",
        };
        if (!validMiningTile(this.state.chunks, target)) continue;
        nearest = distance;
        stair = target;
      }
    }
    if (stair) return { target: stair, x: sx, y: sy };
    if (!hit) return;
    const p = hit.point
      .clone()
      .addScaledVector(hit.face?.normal ?? new THREE.Vector3(), -0.002);
    const x = Math.floor(p.x),
      y = Math.floor(p.z),
      z = Math.floor(p.y),
      tile = tileAt(this.state.chunks, x, y, z);
    const target: MiningTarget = {
      x,
      y,
      z,
      operation: miningOperation(
        tile?.shape ?? "empty",
        hit.face?.normal.y ?? 0,
      ),
    };
    if (!validMiningTile(this.state.chunks, target)) return;
    return { target, x: sx, y: sy };
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
    if (e.button === 0 && this.suppressRectangleClick) {
      this.suppressRectangleClick = false;
      return;
    }
    const dragged = this.dragStart?.moved;
    this.dragStart = undefined;
    if (e.button !== 0 || dragged) return;
    if (this.navigation === "firstPerson") {
      const active = this.firstPerson.active;
      this.firstPerson.capture();
      if (active && this.miningMode === "designate" && !this.miningBusy) {
        const preview = this.miningTarget();
        if (preview) this.onMine?.(preview.target);
      }
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
        this.camera.near = 0.05;
        this.camera.far = Math.max(
          128,
          Math.hypot(this.bounds?.width ?? 0, this.bounds?.depth ?? 0) + 16,
        );
        this.camera.updateProjectionMatrix();
        this.navigation = "firstPerson";
        this.leave();
        this.firstPerson.enter(x, y, z);
        this.refreshRoofs();
        this.onNavigationChange?.(this.navigation);
      }
      return;
    }
    if (this.miningMode !== "inspect") {
      const preview = this.miningTarget({ x: e.clientX, y: e.clientY });
      if (preview && !this.miningBusy) this.onMine?.(preview.target);
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
    this.cancelMining();
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
    this.camera.far = 4000;
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
          disposeTerrain(mesh);
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
    this.invalidate();
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
        disposeTerrain(mesh);
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
    this.cancelMining();
    if (this.navigation === "firstPerson" && !keepWalking)
      this.setFirstPerson(true);
    this.leave();
    this.invalidate();
    this.creatures.clear();
    this.projectiles.clear();
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
      disposeTerrain(mesh);
    }
    this.meshes.clear();
    this.dirty.clear();
    this.capMesher.clear();
    this.treeMesher.clear();
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
  update(chunks: Chunk[], priority = false) {
    this.flows.update(chunks);
    const changed = chunks.map(chunkKey);
    const neighbours = chunks.flatMap(affected);
    // A branching hierarchy and a taper can cross chunk/z boundaries. Reuse
    // worker results when unchanged, and invalidate nearby tree columns when
    // new cells arrive or a previously visible tree is removed.
    for (const c of chunks)
      if (
        c.tiles.some((t) => t.treeGraphic) ||
        this.meshes?.get(chunkKey(c))?.children.some((m) => m.userData.tree)
      )
        for (const other of this.state.chunks.values())
          if (Math.abs(other.x - c.x) <= 16 && Math.abs(other.y - c.y) <= 16) {
            neighbours.push(chunkKey(other));
            this.emptyChunks.delete(other);
          }
    // A cap is extruded across several levels. A newly streamed top/bottom
    // changes its continuous surface throughout that local column window.
    for (const c of chunks)
      if (
        c.tiles.some((t) => /CAP/.test(t.treeGraphic ?? "")) ||
        this.meshes?.get(chunkKey(c))?.children.length
      ) {
        for (let x = c.x - 16; x <= c.x + 16; x += 16)
          for (let y = c.y - 16; y <= c.y + 16; y += 16)
            for (let z = c.z - 1; z <= c.z + 1; z++) {
              const key = `${x},${y},${z}`,
                other = this.state.chunks.get(key);
              if (other) {
                neighbours.push(key);
                this.emptyChunks.delete(other);
              }
            }
      }
    if (priority && chunks.length) {
      // Reinsert even already queued edits at the front. The edited geometry
      // must not wait behind cutaway/streaming rebuilds or its neighbours.
      this.dirty = new Set([...changed, ...neighbours, ...this.dirty]);
    } else {
      for (const k of neighbours) this.dirty.add(k);
    }
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
    this.orbitKeyboard.update((start - this.lastFrame) / 1000);
    if (this.navigation === "firstPerson") {
      const focus = `${Math.floor(this.camera.position.x / 16)},${Math.floor(this.camera.position.z / 16)}`;
      if (focus !== this.lastFocus) {
        this.lastFocus = focus;
        this.onWalkLevel?.(this.cut);
      }
    }
    this.lastFrame = start;
    if (this.navigation !== "firstPerson") this.controls.update();
    const cameraChanged =
      !this.renderedPosition.equals(this.camera.position) ||
      !this.renderedRotation.equals(this.camera.quaternion) ||
      !this.renderedProjection.equals(this.camera.projectionMatrix);
    if (
      !this.renderScheduler.take(
        start,
        cameraChanged ||
          this.dirty.size > 0 ||
          this.miningPressed ||
          this.selector.visible ||
          this.flows.visibleCount > 0 ||
          this.projectiles.animating(start) ||
          this.atlasVersion !== this.terrainAtlas.texture.version,
      )
    )
      return;

    if (this.rectangle && this.miningPointer)
      this.updateRectangle(this.miningPointer);
    const r = this.rectangle,
      rect = this.renderer.domElement.getBoundingClientRect();
    const preview = r
      ? {
          target: r.start,
          x: (this.miningPointer?.x ?? rect.left) - rect.left,
          y: (this.miningPointer?.y ?? rect.top) - rect.top,
        }
      : this.miningTarget();
    const rectangle = r
      ? {
          width: Math.abs(r.end.x - r.start.x) + 1,
          depth: Math.abs(r.end.y - r.start.y) + 1,
          valid: validDesignationRectangle({
            ...r.start,
            x2: r.end.x,
            y2: r.end.y,
          }),
        }
      : undefined;
    const progress = this.miningPressed
      ? this.miningHold.progress(preview?.target, start)
      : 0;
    if (this.miningPressed && !this.miningHold.active)
      this.miningPressed = false;
    this.miningOutline.visible = !!preview;
    this.miningOutline.scale.set(
      rectangle?.width ?? 1,
      1,
      rectangle?.depth ?? 1,
    );
    this.miningOutline.material.color.setHex(
      rectangle?.valid === false ? 0xff6677 : 0xffdc72,
    );
    if (preview)
      this.miningOutline.position.set(
        r ? (r.start.x + r.end.x + 1) / 2 : preview.target.x + 0.5,
        preview.target.z + 0.5,
        r ? (r.start.y + r.end.y + 1) / 2 : preview.target.y + 0.5,
      );
    this.onMiningPreview?.({
      ...preview,
      progress: this.miningBusy ? 1 : progress,
      holding: this.miningPressed,
      rectangle,
    });
    if (this.miningPressed && progress >= 1 && preview && !this.miningBusy) {
      this.cancelMining();
      this.onMine?.(preview.target);
    }
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
      // Keep the last complete cap on screen while a changed surface is meshed.
      const previousCaps = old ? [...old.children] : [];
      for (const cap of previousCaps) old!.remove(cap);
      if (old) {
        this.scene.remove(old);
        disposeTerrain(old);
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
        true,
        true,
      );
      if (
        !c.objects?.length &&
        c.tiles.every((t) => t.shape === "empty" && !t.liquid && !t.treeGraphic)
      )
        this.emptyChunks.add(c);
      const packed = indexAttributes({
        position: { array: new Float32Array(data.positions), size: 3 },
        color: { array: new Float32Array(data.colors), size: 3 },
        uv: { array: new Float32Array(data.uvs), size: 2 },
      });
      const g = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(packed.attributes))
        g.setAttribute(name, new THREE.BufferAttribute(a.array, a.size));
      if (packed.index) g.setIndex(new THREE.BufferAttribute(packed.index, 1));
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, this.material);
      for (const cap of previousCaps) m.add(cap);
      const hasCap = this.capMesher.request(
        c,
        this.state.chunks,
        this.terrainAtlas.uv,
        this.navigation !== "firstPerson" && c.z === this.cut,
        (data) => {
          if (this.meshes.get(k) !== m) return;
          for (const cap of [...m.children]) {
            if (cap.userData.tree) continue;
            m.remove(cap);
            if (cap instanceof THREE.Mesh) disposeTerrain(cap);
          }
          if (!data.positions.length) return;
          const capGeometry = new THREE.BufferGeometry();
          capGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(data.positions, 3),
          );
          capGeometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(data.normals, 3),
          );
          capGeometry.setAttribute(
            "capRect",
            new THREE.BufferAttribute(data.caps, 4),
          );
          capGeometry.setAttribute(
            "undersideRect",
            new THREE.BufferAttribute(data.undersides, 4),
          );
          if (data.indices)
            capGeometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
          capGeometry.computeBoundingSphere();
          m.add(new THREE.Mesh(capGeometry, this.capMaterial));
          this.invalidate();
          this.emptyChunks.delete(c);
        },
        Math.hypot(
          c.x + 8 - this.camera.position.x,
          c.y + 8 - this.camera.position.z,
          (c.z - this.camera.position.y) * 2,
        ),
      );
      if (hasCap) this.emptyChunks.delete(c);
      else
        for (const cap of [...m.children]) {
          if (cap.userData.tree) continue;
          m.remove(cap);
          if (cap instanceof THREE.Mesh) disposeTerrain(cap);
        }
      const hasTree = this.treeMesher.request(
        c,
        this.state.chunks,
        this.terrainAtlas.uv,
        (tree) => {
          if (this.meshes.get(k) !== m) return;
          for (const child of [...m.children])
            if (child.userData.tree) {
              m.remove(child);
              if (child instanceof THREE.Mesh) disposeTerrain(child);
            }
          if (!tree.positions.length) return;
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(tree.positions, 3),
          );
          geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(tree.colors, 3),
          );
          geometry.setAttribute("uv", new THREE.BufferAttribute(tree.uvs, 2));
          if (tree.indices)
            geometry.setIndex(new THREE.BufferAttribute(tree.indices, 1));
          geometry.computeBoundingSphere();
          const child = new THREE.Mesh(geometry, this.material);
          child.userData.tree = true;
          m.add(child);
          this.invalidate();
          this.emptyChunks.delete(c);
        },
        Math.hypot(
          c.x + 8 - this.camera.position.x,
          c.y + 8 - this.camera.position.z,
          (c.z - this.camera.position.y) * 2,
        ),
      );
      if (!hasTree)
        for (const child of [...m.children])
          if (child.userData.tree) {
            m.remove(child);
            if (child instanceof THREE.Mesh) disposeTerrain(child);
          }
      if (!data.positions.length && !hasCap && !hasTree) {
        g.dispose();
        continue;
      }
      m.userData.chunkKey = k;
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
    this.scenery.frame(this.camera, visibleLevel, this.cut - LEVELS_BELOW);
    this.liquids.frame(start, visibleLevel, this.cut - LEVELS_BELOW);
    this.flows.frame(
      this.camera,
      this.state.chunks,
      start,
      visibleLevel,
      this.cut - LEVELS_BELOW,
    );
    this.projectiles.frame(
      this.state.chunks,
      start,
      visibleLevel,
      this.cut - LEVELS_BELOW,
    );
    this.renderer.render(this.scene, this.camera);
    this.renderedPosition.copy(this.camera.position);
    this.renderedRotation.copy(this.camera.quaternion);
    this.renderedProjection.copy(this.camera.projectionMatrix);
    this.atlasVersion = this.terrainAtlas.texture.version;
    if (start - this.lastStats < 250) return;
    this.lastStats = start;
    this.stats.textContent = `${this.state.chunks.size} blocks · ${this.creatures.visibleCount} creatures · ${this.scenery.visibleCount} furnishings/plants/items · ${this.renderer.info.render.triangles.toLocaleString()} triangles · ${this.dirty.size + this.capMesher.pending + this.treeMesher.pending} queued`;
  };
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener("click", this.pick);
    this.renderer.domElement.removeEventListener("pointerdown", this.beginDrag);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.rectangleDown,
      true,
    );
    this.renderer.domElement.removeEventListener("pointermove", this.hover);
    this.renderer.domElement.removeEventListener("pointerleave", this.leave);
    this.firstPerson.dispose();
    this.orbitKeyboard.dispose();
    window.removeEventListener("pointerup", this.rectangleUp, true);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.miningDown,
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.miningMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.miningLeave,
    );
    window.removeEventListener("pointerup", this.cancelMining);
    window.removeEventListener("pointercancel", this.cancelMining);
    window.removeEventListener("blur", this.cancelMining);
    this.miningOutline.geometry.dispose();
    this.miningOutline.material.dispose();
    this.selector.geometry.dispose();
    this.selector.material.dispose();
    this.selectorBorder.geometry.dispose();
    this.selectorBorder.material.dispose();
    this.controls.dispose();
    this.creatures.dispose();
    this.projectiles.dispose();
    this.scenery.dispose();
    this.liquids.dispose();
    this.flows.dispose();
    for (const m of this.meshes.values()) disposeTerrain(m);
    this.material.dispose();
    this.capMaterial.dispose();
    this.capMesher.dispose();
    this.treeMesher.dispose();
    this.terrainAtlas.dispose();
    for (const event of ["pointermove", "pointerdown", "pointerleave"])
      this.renderer.domElement.removeEventListener(event, this.invalidate);
    this.renderer.dispose();
  }
}
