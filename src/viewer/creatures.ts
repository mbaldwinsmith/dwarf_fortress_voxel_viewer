import { CompositeSprites, compositionBounds } from "./composite-sprites.js";
import * as THREE from "three";
import { bottomPadding, SpriteFeet } from "./sprite-ground.js";
import { surfaceHeight } from "./traversal.js";
import {
  LEVELS_BELOW,
  tileAt,
  type Chunk,
  type Creature,
  type ServerMessage,
  type SpriteRef,
} from "../shared/model.js";
export class CreatureSprites {
  group = new THREE.Group();
  private composites = new CompositeSprites();
  visibleCount = 0;
  private sprites = new Map<number, { object: THREE.Sprite; unit: Creature }>();
  private materials = new Map<string, THREE.SpriteMaterial>();
  private sheets = new Map<string, THREE.Texture>();
  private textures: THREE.Texture[] = [];
  private atlasTextures = new Map<string, THREE.Texture>();
  private disposed = false;
  private feet = new SpriteFeet();
  private tick = 0;
  private session = "";
  private markerTexture: THREE.DataTexture;
  private marker: THREE.SpriteMaterial;
  constructor() {
    const pixels = new Uint8Array(8 * 8 * 4);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const i = (y * 8 + x) * 4;
        pixels.set(
          [255, 204, 100, Math.abs(x - 3.5) + Math.abs(y - 3.5) < 4 ? 255 : 0],
          i,
        );
      }
    this.markerTexture = new THREE.DataTexture(pixels, 8, 8);
    this.markerTexture.magFilter = THREE.NearestFilter;
    this.markerTexture.needsUpdate = true;
    this.marker = new THREE.SpriteMaterial({
      map: this.markerTexture,
      alphaTest: 0.3,
      transparent: false,
      depthWrite: true,
    });
    this.marker.userData.bottomPadding = bottomPadding(pixels, 8, 8);
  }
  private material(r: SpriteRef) {
    const key = JSON.stringify(r);
    let material = this.materials.get(key);
    if (material) return material;
    if (this.materials.size >= 256) return this.marker;
    let sheet = this.sheets.get(r.asset);
    if (!sheet) {
      sheet = new THREE.TextureLoader().load(
        `/local-art/${r.asset}`,
        () => {
          if (this.disposed) return;
          for (const [k, m] of this.materials)
            if (k.includes(r.asset)) {
              const texture = this.atlasTextures.get(k);
              if (texture) {
                texture.needsUpdate = true;
                m.map = texture;
                m.userData.bottomPadding = this.feet.get(
                  texture.image as HTMLImageElement,
                  JSON.parse(k) as SpriteRef,
                );
                m.needsUpdate = true;
              }
            }
        },
        undefined,
        () => {
          console.warn(
            "Local creature sheet unavailable; using markers",
            r.asset,
          );
          for (const [k, m] of this.materials)
            if (k.includes(r.asset)) {
              m.map = this.markerTexture;
              m.needsUpdate = true;
            }
        },
      );
      sheet.colorSpace = THREE.SRGBColorSpace;
      sheet.magFilter = THREE.NearestFilter;
      sheet.minFilter = THREE.NearestFilter;
      sheet.generateMipmaps = false;
      this.sheets.set(r.asset, sheet);
    }
    const texture = sheet.clone();
    texture.repeat.set(r.width / r.pageWidth, r.height / r.pageHeight);
    texture.offset.set(r.x / r.pageWidth, 1 - (r.y + r.height) / r.pageHeight);
    this.textures.push(texture);
    this.atlasTextures.set(key, texture);
    material = new THREE.SpriteMaterial({
      map: sheet.image ? texture : this.markerTexture,
      alphaTest: 0.3,
      depthTest: true,
      transparent: false,
      depthWrite: true,
    });
    material.userData.bottomPadding = this.marker.userData.bottomPadding;
    this.materials.set(key, material);
    return material;
  }
  snapshot(message: Extract<ServerMessage, { type: "creatures" }>) {
    if (this.session !== message.session) {
      this.clear();
      this.session = message.session;
    }
    if (message.tick <= this.tick) return;
    this.tick = message.tick;
    this.composites.retain(
      message.creatures.flatMap((u) => (u.layers?.length ? [u.layers] : [])),
    );
    const ids = new Set(message.creatures.map((u) => u.id));
    for (const [id, s] of this.sprites)
      if (!ids.has(id)) {
        this.group.remove(s.object);
        this.sprites.delete(id);
      }
    for (const unit of message.creatures) {
      let s = this.sprites.get(unit.id);
      const material = unit.layers?.length
        ? this.composites.material(unit.layers, this.marker)
        : unit.sprite
          ? this.material(unit.sprite)
          : this.marker;
      if (!s) {
        s = { object: new THREE.Sprite(material), unit };
        s.object.center.set(0.5, 0);
        this.sprites.set(unit.id, s);
        this.group.add(s.object);
      }
      s.unit = unit;
      s.object.material = material;
      // Native large images span several 32px game tiles, including their
      // transparent padding. Keep their scale as well as their aspect ratio.
      const height = unit.sprite
          ? (1.2 * unit.sprite.height) / 32
          : unit.layers?.length
            ? 1.2
            : 0.45,
        width = unit.sprite
          ? (height * unit.sprite.width) / unit.sprite.height
          : 0.45;
      const bounds = unit.layers?.length
        ? compositionBounds(unit.layers)
        : undefined;
      s.object.center.set(
        bounds ? bounds.anchorX / bounds.width : 0.5,
        bounds ? bounds.footFromBottom / bounds.height : 0,
      );
      s.object.scale.set(
        bounds ? (1.2 * bounds.width) / 32 : width,
        bounds ? (1.2 * bounds.height) / 32 : height,
        1,
      );
      s.object.position.set(unit.x + 0.5, unit.z + 0.12, unit.y + 0.5);
    }
  }
  update(
    chunks: Map<string, Chunk>,
    cut: number,
    minLevel = cut - LEVELS_BELOW,
  ) {
    this.visibleCount = 0;
    for (const s of this.sprites.values()) {
      const u = s.unit,
        t = tileAt(chunks, u.x, u.y, u.z);
      s.object.visible =
        !!t && t.shape !== "unknown" && u.z <= cut && u.z >= minLevel;
      if (s.object.visible) {
        this.visibleCount++;
        s.object.center.y = Number(
          s.object.material.userData.bottomPadding ?? 0,
        );
        s.object.position.y =
          surfaceHeight(chunks, u.x + 0.5, u.y + 0.5, u.z) ?? u.z + 0.12;
      }
    }
  }
  clear() {
    this.group.clear();
    this.sprites.clear();
    this.composites.retain([]);
    this.tick = 0;
    this.session = "";
  }
  dispose() {
    this.disposed = true;
    this.composites.dispose();
    this.clear();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const t of this.sheets.values()) t.dispose();
    this.marker.dispose();
    this.markerTexture.dispose();
  }
}
