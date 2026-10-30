import type { ServerMessage, Shape } from "./model.js";
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const int = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && Math.abs(v) < 1000000;
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 1000;
const shapes: Shape[] = ["empty", "wall", "floor", "ramp", "stairs", "unknown"];
export function parseServerMessage(value: unknown): ServerMessage {
  if (!object(value)) throw Error("Expected message object");
  if (value.type === "status" && text(value.message))
    return value as ServerMessage;
  if (!text(value.session) || !value.session) throw Error("Missing session");
  if (value.type === "mining-assets") {
    validateSprite(value.pick);
    validateSprite(value.spade);
    return value as ServerMessage;
  }
  if (
    value.type === "mining-result" &&
    int(value.id) &&
    value.id > 0 &&
    typeof value.ok === "boolean" &&
    text(value.message)
  )
    return value as ServerMessage;
  if (
    (value.type === "view" || (value.type === "reset" && text(value.world))) &&
    object(value.bounds)
  ) {
    if (
      value.type === "view" &&
      (!int(value.level) || !["screen", "map"].includes(String(value.mode)))
    )
      throw Error("Invalid view");
    if (
      value.mode !== undefined &&
      value.mode !== "screen" &&
      value.mode !== "map"
    )
      throw Error("Invalid render mode");
    const b = value.bounds;
    if (
      value.focus !== undefined &&
      (!object(value.focus) ||
        !int(value.focus.x) ||
        !int(value.focus.y) ||
        value.focus.x < Number(b.x) ||
        value.focus.y < Number(b.y) ||
        value.focus.x >= Number(b.x) + Number(b.width) ||
        value.focus.y >= Number(b.y) + Number(b.depth))
    )
      throw Error("Invalid canopy focus");
    if (
      ["x", "y", "z", "width", "depth", "height"].every((k) => int(b[k])) &&
      Number(b.width) >= 0 &&
      Number(b.depth) >= 0 &&
      Number(b.height) >= 0 &&
      Number(b.width) <= 16000 &&
      Number(b.depth) <= 16000 &&
      Number(b.height) <= 1000 &&
      (value.level === undefined ||
        (int(value.level) &&
          value.level >= Number(b.z) &&
          value.level < Number(b.z) + Number(b.height)))
    )
      return value as ServerMessage;
  }
  if (
    value.type === "creatures" &&
    int(value.tick) &&
    value.tick > 0 &&
    Array.isArray(value.creatures) &&
    value.creatures.length <= 2000
  ) {
    for (const c of value.creatures) {
      if (
        !object(c) ||
        !int(c.id) ||
        !int(c.x) ||
        !int(c.y) ||
        !int(c.z) ||
        !text(c.name)
      )
        throw Error("Invalid creature");
      if (c.layers !== undefined) {
        if (!Array.isArray(c.layers) || c.layers.length > 64)
          throw Error("Invalid layer count");
        for (const l of c.layers) {
          if (!object(l)) throw Error("Invalid layer");
          validateSprite(l.sprite);
          if (
            l.offset !== undefined &&
            (!Array.isArray(l.offset) ||
              l.offset.length !== 2 ||
              !l.offset.every((v) => int(v) && Math.abs(v) <= 512))
          )
            throw Error("Invalid layer offset");
          if (
            l.eyeColor !== undefined &&
            (!Array.isArray(l.eyeColor) ||
              l.eyeColor.length !== 3 ||
              !l.eyeColor.every((n) => int(n) && n >= 0 && n <= 255))
          )
            throw Error("Invalid eye colour");
          if (l.palette !== undefined) {
            const p = l.palette;
            if (
              !object(p) ||
              typeof p.asset !== "string" ||
              !/^[a-f0-9]{24}$/.test(p.asset) ||
              !int(p.row) ||
              !int(p.sourceRow) ||
              p.row < 0 ||
              p.row > 16384 ||
              p.sourceRow < 0 ||
              p.sourceRow > 16384
            )
              throw Error("Invalid palette");
          }
          if (
            l.tint !== undefined &&
            (!Array.isArray(l.tint) ||
              l.tint.length !== 3 ||
              !l.tint.every((n) => int(n) && n >= 0 && n <= 255))
          )
            throw Error("Invalid tint");
        }
      }
      if (c.sprite !== undefined) {
        validateSprite(c.sprite);
      }
    }
    return value as ServerMessage;
  }
  if (
    value.type === "chunks" &&
    int(value.sequence) &&
    value.sequence > 0 &&
    int(value.pollMs) &&
    (value.priority === undefined || typeof value.priority === "boolean") &&
    Array.isArray(value.chunks) &&
    value.chunks.length <= 45
  ) {
    for (const c of value.chunks) {
      if (object(c) && c.ceilingTexture !== undefined)
        validateSprite(c.ceilingTexture);
      if (
        !object(c) ||
        !int(c.x) ||
        !int(c.y) ||
        !int(c.z) ||
        c.x % 16 !== 0 ||
        c.y % 16 !== 0 ||
        !Array.isArray(c.tiles) ||
        c.tiles.length !== 256
      )
        throw Error("Invalid chunk");
      for (const t of c.tiles)
        if (
          !object(t) ||
          !shapes.includes(t.shape as Shape) ||
          !int(t.material) ||
          !text(t.name) ||
          (t.treeGraphic !== undefined &&
            (typeof t.treeGraphic !== "string" ||
              !/^TREE_[A-Z0-9_]{1,80}$/.test(t.treeGraphic) ||
              t.shape === "unknown"))
        )
          throw Error("Invalid tile");
      for (const t of c.tiles) {
        if (object(t.liquid) && t.liquid.surface !== undefined)
          validateSprite(t.liquid.surface);
        if (t.tree !== undefined) {
          if (
            t.shape === "unknown" ||
            !t.treeGraphic ||
            !object(t.tree) ||
            (t.tree.species !== undefined && !text(t.tree.species)) ||
            (t.tree.roundStem !== undefined && t.tree.roundStem !== true) ||
            (t.tree.progress !== undefined &&
              (!int(t.tree.progress) ||
                t.tree.progress < 0 ||
                t.tree.progress > 100))
          )
            throw Error("Invalid tree");
          for (const part of ["bark", "side", "leaves", "cap", "capSurface"])
            if (t.tree[part] !== undefined) validateSprite(t.tree[part]);
        }
        if (
          t.liquid !== undefined &&
          (t.shape === "unknown" ||
            !object(t.liquid) ||
            !["water", "magma"].includes(String(t.liquid.kind)) ||
            !int(t.liquid.depth) ||
            t.liquid.depth < 1 ||
            t.liquid.depth > 7)
        )
          throw Error("Invalid liquid");
        if (
          t.variant !== undefined &&
          (!int(t.variant) ||
            t.variant < 0 ||
            t.variant > 3 ||
            t.shape === "unknown")
        )
          throw Error("Invalid tile variant");
        if (t.wallRimTint !== undefined && (!t.wallRim || !rgb(t.wallRimTint)))
          throw Error("Invalid wall rim tint");
        if (
          t.wallMask !== undefined &&
          (!int(t.wallMask) ||
            t.wallMask < 1 ||
            t.wallMask > 255 ||
            t.shape !== "wall")
        )
          throw Error("Invalid wall neighbour mask");
        if (t.wallRim !== undefined) {
          if (
            t.shape !== "wall" ||
            !t.wallMask ||
            !Array.isArray(t.wallRim) ||
            t.wallRim.length > 5
          )
            throw Error("Invalid wall rim");
          for (const r of t.wallRim) validateSprite(r);
        }
        if (t.wallCap !== undefined) {
          if (t.shape !== "wall" && t.shape !== "unknown")
            throw Error("Invalid wall cap");
          validateSprite(t.wallCap);
        }
        if (
          t.sealed !== undefined &&
          (t.sealed !== true ||
            t.shape !== "wall" ||
            t.material !== 2 ||
            t.name !== "Solid rock" ||
            t.color !== undefined ||
            t.materialName !== undefined ||
            t.surfaces !== undefined ||
            t.smooth !== undefined ||
            t.treeGraphic !== undefined ||
            t.wallMask !== undefined ||
            t.wallRim !== undefined ||
            t.wallRimTint !== undefined ||
            t.variant !== undefined)
        )
          throw Error("Unredacted enclosed wall");
        if (
          t.materialName !== undefined &&
          (!text(t.materialName) || t.shape === "unknown")
        )
          throw Error("Invalid terrain material name");
        if (t.color !== undefined && (t.shape === "unknown" || !rgb(t.color)))
          throw Error("Invalid terrain colour");
        if (
          t.smooth !== undefined &&
          (t.smooth !== true || t.shape === "unknown")
        )
          throw Error("Invalid smooth terrain");
        if (t.surfaces !== undefined) {
          if (!object(t.surfaces) || t.shape === "unknown")
            throw Error("Invalid terrain surfaces");
          validateSprite(t.surfaces.top);
          validateSprite(t.surfaces.side);
          if (t.surfaces.topTint !== undefined && !rgb(t.surfaces.topTint))
            throw Error("Invalid surface colour");
        }
      }
      if (c.flows !== undefined) {
        if (!Array.isArray(c.flows) || c.flows.length > 256)
          throw Error("Invalid flow count");
        for (const f of c.flows) {
          if (
            !object(f) ||
            !int(f.x) ||
            !int(f.y) ||
            !int(f.z) ||
            f.z !== c.z ||
            f.x < Number(c.x) ||
            f.x >= Number(c.x) + 16 ||
            f.y < Number(c.y) ||
            f.y >= Number(c.y) + 16 ||
            !int(f.density) ||
            f.density < 1 ||
            f.density > 100 ||
            ![
              "smoke",
              "mist",
              "steam",
              "fire",
              "dragonfire",
              "magma-mist",
              "miasma",
              "dust",
              "gas",
              "vapor",
              "item-cloud",
            ].includes(String(f.kind))
          )
            throw Error("Invalid flow");
          if (
            (
              c.tiles[(f.y - Number(c.y)) * 16 + f.x - Number(c.x)] as Record<
                string,
                unknown
              >
            ).shape === "unknown"
          )
            throw Error("Hidden flow");
          if (f.frames !== undefined) {
            if (!Array.isArray(f.frames) || f.frames.length > 4)
              throw Error("Invalid flow frames");
            for (const frame of f.frames) validateSprite(frame);
          }
        }
      }
      if (c.objects !== undefined) {
        if (!Array.isArray(c.objects) || c.objects.length > 768)
          throw Error("Invalid scenery count");
        const ids = new Set<string>();
        for (const o of c.objects) {
          if (
            !object(o) ||
            !text(o.id) ||
            ids.has(o.id) ||
            !text(o.name) ||
            !int(o.x) ||
            !int(o.y) ||
            !int(o.z) ||
            o.z !== c.z ||
            o.x < Number(c.x) ||
            o.x >= Number(c.x) + 16 ||
            o.y < Number(c.y) ||
            o.y >= Number(c.y) + 16 ||
            !["ground", "door", "plant", "upright"].includes(String(o.kind))
          )
            throw Error("Invalid scenery object");
          ids.add(o.id);
          if (
            o.furniture !== undefined &&
            (!object(o.furniture) ||
              ![
                "table",
                "chair",
                "bed",
                "cabinet",
                "coffin",
                "bookcase",
                "chest",
              ].includes(String(o.furniture.type)) ||
              (o.furniture.heavy !== undefined && o.furniture.heavy !== true) ||
              o.kind !== "ground" ||
              !o.id.startsWith("b:"))
          )
            throw Error("Invalid furniture mesh");
          if (o.tint !== undefined && !rgb(o.tint))
            throw Error("Invalid scenery tint");
          if (o.palette !== undefined) {
            const p = o.palette;
            if (
              !object(p) ||
              typeof p.asset !== "string" ||
              !/^[a-f0-9]{24}$/.test(p.asset) ||
              !int(p.row) ||
              !int(p.sourceRow) ||
              p.row < 0 ||
              p.row > 16384 ||
              p.sourceRow < 0 ||
              p.sourceRow > 16384
            )
              throw Error("Invalid scenery palette");
          }
          if (o.details !== undefined) {
            if (
              !Array.isArray(o.details) ||
              o.details.length > 63 ||
              o.kind !== "ground"
            )
              throw Error("Invalid scenery detail layers");
            for (const d of o.details) {
              if (!object(d)) throw Error("Invalid scenery detail");
              validateSprite(d.sprite);
              if (d.palette !== undefined) {
                const p = d.palette;
                if (
                  !object(p) ||
                  typeof p.asset !== "string" ||
                  !/^[a-f0-9]{24}$/.test(p.asset) ||
                  !int(p.row) ||
                  !int(p.sourceRow) ||
                  p.row < 0 ||
                  p.row > 16384 ||
                  p.sourceRow < 0 ||
                  p.sourceRow > 16384
                )
                  throw Error("Invalid detail palette");
              }
              if (d.tint !== undefined && !rgb(d.tint))
                throw Error("Invalid detail tint");
              if (
                d.brightness !== undefined &&
                (typeof d.brightness !== "number" ||
                  !Number.isFinite(d.brightness) ||
                  d.brightness < 0 ||
                  d.brightness > 4)
              )
                throw Error("Invalid detail brightness");
            }
          }
          const tile = c.tiles[(o.y - Number(c.y)) * 16 + o.x - Number(c.x)];
          if (!object(tile) || tile.shape === "unknown")
            throw Error("Hidden scenery object");
          if (o.sprite !== undefined) validateSprite(o.sprite);
          if (o.overlay !== undefined) {
            if (o.kind !== "ground") throw Error("Invalid scenery overlay");
            validateSprite(o.overlay);
          }
        }
      }
    }
    return value as ServerMessage;
  }
  throw Error("Invalid viewer message");
}

function validateSprite(r: unknown) {
  if (
    !object(r) ||
    typeof r.asset !== "string" ||
    !/^[a-f0-9]{24}$/.test(r.asset) ||
    !["x", "y", "width", "height", "pageWidth", "pageHeight"].every(
      (k) => int(r[k]) && Number(r[k]) >= 0,
    ) ||
    Number(r.width) < 1 ||
    Number(r.width) > 256 ||
    Number(r.height) > 256 ||
    Number(r.height) < 1 ||
    Number(r.x) + Number(r.width) > Number(r.pageWidth) ||
    Number(r.y) + Number(r.height) > Number(r.pageHeight)
  )
    throw Error("Invalid sprite reference");
}
function rgb(v: unknown) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => int(n) && n >= 0 && n <= 255)
  );
}
