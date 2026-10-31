import * as THREE from "three";
import {
  tileAt,
  type Chunk,
  type Projectile,
  type ServerMessage,
} from "../shared/model.js";
import { TerrainAtlas } from "./terrain-atlas.js";
import { CompositeSprites } from "./composite-sprites.js";

type Flight = {
  item: Projectile;
  object: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  at: number;
  duration: number;
};
const centre = (p: Projectile) =>
  new THREE.Vector3(p.x + 0.5, p.z + 0.5, p.y + 0.5);
const up = new THREE.Vector3(0, 1, 0);
export const PROJECTILE_EXPIRY_MS = 1500;

function revealed(chunks: Map<string, Chunk>, p: THREE.Vector3) {
  const t = tileAt(chunks, Math.floor(p.x), Math.floor(p.z), Math.floor(p.y));
  return !!t && t.shape !== "unknown";
}
/** Do not interpolate across unknown terrain or a teleport-sized sample gap. */
export function revealedFlight(
  chunks: Map<string, Chunk>,
  a: THREE.Vector3,
  b: THREE.Vector3,
) {
  const steps = Math.ceil(a.distanceTo(b) * 4);
  if (steps > 256) return false;
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    p.lerpVectors(a, b, steps ? i / steps : 1);
    if (!revealed(chunks, p)) return false;
  }
  return true;
}

export class ProjectileModels {
  group = new THREE.Group();
  visibleCount = 0;
  private flights = new Map<number, Flight>();
  private composites = new CompositeSprites();
  private native: THREE.MeshBasicMaterial;
  private fallback = new THREE.SpriteMaterial({
    color: 0xffffff,
    alphaTest: 0.3,
    transparent: false,
  });
  private tick = 0;
  private session = "";
  private received = -Infinity;
  constructor(private atlas: TerrainAtlas) {
    this.native = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      transparent: false,
    });
  }
  private model(p: Projectile) {
    const group = new THREE.Group();
    group.name = `projectile:${p.id}:${p.kind}`;
    const shaft = ["arrow", "bolt", "ballista"].includes(p.kind);
    if (shaft && p.sprite) {
      // Native straight ammunition points along local +Y. Two intersecting
      // planes retain the feather/head silhouette from every flight angle.
      const uv = this.atlas.uv(p.sprite, true);
      for (const rotation of [0, Math.PI / 2]) {
        const geometry = new THREE.PlaneGeometry(p.size * 1.3, p.size * 1.3);
        const a = geometry.getAttribute("uv");
        for (let i = 0; i < a.count; i++)
          a.setXY(
            i,
            THREE.MathUtils.lerp(uv[0], uv[2], a.getX(i)),
            THREE.MathUtils.lerp(uv[1], uv[3], a.getY(i)),
          );
        const mesh = new THREE.Mesh(geometry, this.native);
        mesh.rotation.y = rotation;
        group.add(mesh);
      }
      // A narrow solid shaft closes the edge-on seam between the native planes.
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
          p.kind === "ballista" ? 0.025 : 0.009,
          p.kind === "ballista" ? 0.025 : 0.009,
          p.size * 0.65,
          5,
        ),
        new THREE.MeshBasicMaterial({ color: 0x8c7452 }),
      );
      group.add(mesh);
    } else if (p.kind === "item" && p.sprite) {
      const sprite = new THREE.Sprite(
        this.composites.material([{ sprite: p.sprite }], this.fallback),
      );
      const size = Math.max(0.45, p.size * 1.4);
      sprite.scale.set((size * p.sprite.width) / p.sprite.height, size, 1);
      group.add(sprite);
    } else {
      const geometry = shaft
        ? new THREE.ConeGeometry(0.055, p.size, 5)
        : new THREE.DodecahedronGeometry(p.size * 0.5, 0);
      const colors = [],
        normals = geometry.getAttribute("normal");
      const color = new THREE.Color().setRGB(
        ...(p.color.map((v) => v / 255) as [number, number, number]),
        THREE.SRGBColorSpace,
      );
      for (let i = 0; i < normals.count; i++) {
        const shade =
          0.7 +
          0.3 *
            Math.max(
              0,
              normals.getY(i) * 0.8 -
                normals.getX(i) * 0.4 +
                normals.getZ(i) * 0.2,
            );
        colors.push(color.r * shade, color.g * shade, color.b * shade);
      }
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ vertexColors: true }),
        ),
      );
    }
    return group;
  }
  private remove(f: Flight) {
    this.group.remove(f.object);
    f.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material !== this.native)
          (o.material as THREE.Material).dispose();
      }
    });
  }
  snapshot(
    message: Extract<ServerMessage, { type: "projectiles" }>,
    now = performance.now(),
  ) {
    if (this.session !== message.session) {
      this.clear();
      this.session = message.session;
    }
    if (message.tick <= this.tick) return;
    this.tick = message.tick;
    const interval = Math.min(150, Math.max(40, now - this.received));
    this.received = now;
    const ids = new Set(message.projectiles.map((p) => p.id));
    for (const [id, f] of this.flights)
      if (!ids.has(id)) {
        this.remove(f);
        this.flights.delete(id);
      }
    this.composites.retain(
      message.projectiles
        .filter((p) => p.kind === "item" && p.sprite)
        .map((p) => [{ sprite: p.sprite! }]),
    );
    for (const p of message.projectiles) {
      let f = this.flights.get(p.id);
      const to = centre(p);
      if (
        f &&
        (f.item.kind !== p.kind ||
          f.item.size !== p.size ||
          JSON.stringify(f.item.sprite) !== JSON.stringify(p.sprite) ||
          String(f.item.color) !== String(p.color))
      ) {
        this.remove(f);
        this.flights.delete(p.id);
        f = undefined;
      }
      if (!f) {
        f = {
          item: p,
          object: this.model(p),
          from: to.clone(),
          to,
          at: now,
          duration: 0,
        };
        f.object.position.copy(to);
        this.flights.set(p.id, f);
        this.group.add(f.object);
      } else {
        // An unchanged sample is paused/stationary: immediately settle on it.
        const stationary = to.equals(f.to);
        f.from.copy(stationary ? to : f.object.position);
        f.to.copy(to);
        f.at = now;
        f.duration = stationary ? 0 : interval;
        f.item = p;
      }
      const direction = new THREE.Vector3(
        p.velocity[0],
        p.velocity[2],
        p.velocity[1],
      );
      if (direction.lengthSq() < 1e-8) direction.subVectors(f.to, f.from);
      if (direction.lengthSq() > 1e-8 && p.kind !== "item")
        f.object.quaternion.setFromUnitVectors(up, direction.normalize());
    }
  }
  frame(
    chunks: Map<string, Chunk>,
    now: number,
    cut: number,
    minLevel: number,
  ) {
    this.visibleCount = 0;
    if (now - this.received > PROJECTILE_EXPIRY_MS) {
      // Preserve ordering after expiry: delayed/duplicate ticks must not revive it.
      for (const f of this.flights.values()) this.remove(f);
      this.flights.clear();
      this.composites.retain([]);
      return;
    }
    for (const f of this.flights.values()) {
      const t = f.duration
        ? Math.min(1, Math.max(0, (now - f.at) / f.duration))
        : 1;
      if (t === 1) f.object.position.copy(f.to);
      else f.object.position.lerpVectors(f.from, f.to, t);
      if (t < 1 && !revealedFlight(chunks, f.from, f.to))
        f.object.position.copy(f.to);
      const p = f.object.position,
        z = Math.floor(p.y);
      f.object.visible = z <= cut && z >= minLevel && revealed(chunks, p);
      if (f.object.visible) this.visibleCount++;
    }
  }
  animating(now: number) {
    for (const f of this.flights.values())
      if (
        now - this.received > PROJECTILE_EXPIRY_MS ||
        // The first frame after the deadline still has to commit the endpoint.
        // Comparing the rendered position also settles stationary snapshots.
        !f.object.position.equals(f.to)
      )
        return true;
    return false;
  }
  clear() {
    for (const f of this.flights.values()) this.remove(f);
    this.flights.clear();
    this.composites.retain([]);
    this.tick = 0;
    this.session = "";
    this.received = -Infinity;
    this.visibleCount = 0;
  }
  dispose() {
    this.clear();
    this.composites.dispose();
    this.native.dispose();
    this.fallback.dispose();
  }
}
