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
  if (value.type === "reset" && text(value.world) && object(value.bounds)) {
    if (
      value.mode !== undefined &&
      value.mode !== "screen" &&
      value.mode !== "map"
    )
      throw Error("Invalid render mode");
    const b = value.bounds;
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
    Array.isArray(value.chunks) &&
    value.chunks.length <= 45
  ) {
    for (const c of value.chunks) {
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
          !text(t.name)
        )
          throw Error("Invalid tile");
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
