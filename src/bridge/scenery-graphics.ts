import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseGraphics, permittedImage } from "./graphics.js";
import type { SpriteRef } from "../shared/model.js";

export function sceneryMappings(text: string) {
  const entries: { key: string; page: string; x: number; y: number }[] = [];
  let plant = "";
  for (const m of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
    const [tag, ...a] = m[1].split(":");
    if (tag === "PLANT_GRAPHICS") plant = a[0];
    if (
      tag === "TILE_GRAPHICS" &&
      a.length >= 4 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: a.slice(3).join(":"),
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
    if (
      plant &&
      ["SHRUB", "SHRUB_DEAD", "SAPLING", "SAPLING_DEAD"].includes(tag) &&
      a.length === 3 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: `PLANT:${plant}:${tag}`,
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
  }
  return entries;
}
export class SceneryGraphics {
  refs = new Map<string, SpriteRef>();
  constructor(private files: Map<string, string>) {}
  async load(installation: string) {
    for (const module of [
      "vanilla_buildings_graphics",
      "vanilla_items_graphics",
      "vanilla_plants_graphics",
    ]) {
      const root = path.join(installation, "data/vanilla", module, "graphics");
      const names = (await readdir(root))
        .filter((n) => n.endsWith(".txt"))
        .sort();
      const text = (
        await Promise.all(
          names.map((n) => readFile(path.join(root, n), "utf8")),
        )
      ).join("\n");
      const pages = parseGraphics(text).pages;
      const ambiguous = new Set<string>();
      for (const e of sceneryMappings(text)) {
        if (ambiguous.has(e.key)) continue;
        const p = pages.get(e.page);
        if (!p) continue;
        if (
          ![p.width, p.height, p.tileWidth, p.tileHeight].every(
            (n) => Number.isInteger(n) && n > 0 && n <= 16384,
          )
        )
          continue;
        const x = e.x * p.tileWidth,
          y = e.y * p.tileHeight;
        if (x + p.tileWidth > p.width || y + p.tileHeight > p.height) continue;
        const file = await permittedImage(root, p.file),
          asset = createHash("sha256").update(file).digest("hex").slice(0, 24);
        const ref = {
          asset,
          x,
          y,
          width: p.tileWidth,
          height: p.tileHeight,
          pageWidth: p.width,
          pageHeight: p.height,
        };
        if (
          this.refs.has(e.key) &&
          JSON.stringify(this.refs.get(e.key)) !== JSON.stringify(ref)
        ) {
          this.refs.delete(e.key);
          ambiguous.add(e.key);
          continue;
        }
        this.files.set(asset, file);
        this.refs.set(e.key, ref);
      }
    }
  }
  get(key: string) {
    return this.refs.get(key);
  }
}
