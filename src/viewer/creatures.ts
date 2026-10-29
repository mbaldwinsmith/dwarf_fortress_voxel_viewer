import * as THREE from "three";
import {
  tileAt,
  type Chunk,
  type Creature,
  type ServerMessage,
  type SpriteRef,
} from "../shared/model.js";
export class CreatureSprites {
  group = new THREE.Group();
  visibleCount = 0;
  private sprites = new Map<number, { object: THREE.Sprite; unit: Creature }>();
  private materials = new Map<string, THREE.SpriteMaterial>();
  private sheets = new Map<string, THREE.Texture>();
  private textures: THREE.Texture[] = [];
  private atlasTextures = new Map<string, THREE.Texture>();
  private disposed = false;
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
      depthWrite: false,
    });
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
      depthWrite: false,
    });
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
    const ids = new Set(message.creatures.map((u) => u.id));
    for (const [id, s] of this.sprites)
      if (!ids.has(id)) {
        this.group.remove(s.object);
        this.sprites.delete(id);
      }
    for (const unit of message.creatures) {
      let s = this.sprites.get(unit.id);
      const material = unit.sprite ? this.material(unit.sprite) : this.marker;
      if (!s) {
        s = { object: new THREE.Sprite(material), unit };
        s.object.center.set(0.5, 0);
        this.sprites.set(unit.id, s);
        this.group.add(s.object);
      }
      s.unit = unit;
      s.object.material = material;
      const height = unit.sprite ? 1.2 : 0.45,
        width = unit.sprite
          ? (height * unit.sprite.width) / unit.sprite.height
          : 0.45;
      s.object.scale.set(width, height, 1);
      s.object.position.set(unit.x + 0.5, unit.z + 0.13, unit.y + 0.5);
    }
  }
  update(chunks: Map<string, Chunk>, cut: number) {
    this.visibleCount = 0;
    for (const s of this.sprites.values()) {
      const u = s.unit,
        t = tileAt(chunks, u.x, u.y, u.z);
      s.object.visible =
        !!t && t.shape !== "unknown" && u.z <= cut && u.z >= cut - 2;
      if (s.object.visible) this.visibleCount++;
    }
  }
  clear() {
    this.group.clear();
    this.sprites.clear();
    this.tick = 0;
    this.session = "";
  }
  dispose() {
    this.disposed = true;
    this.clear();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const t of this.sheets.values()) t.dispose();
    this.marker.dispose();
    this.markerTexture.dispose();
  }
}
