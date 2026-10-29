import {
  parseDwarfLayers,
  chooseDwarfLayers,
  type LayerSet,
  type DwarfAppearance,
} from "./dwarf-layers.js";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { SpriteRef } from "../shared/model.js";
interface Page {
  file: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
}
export function parseGraphics(text: string) {
  const pages = new Map<string, Page>(),
    sprites = new Map<string, { page: string; x: number; y: number }>();
  let page: Page | undefined,
    creature = "",
    layered = false;
  for (const match of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
    const [tag, ...a] = match[1].split(":");
    if (tag === "TILE_PAGE") {
      page = { file: "", width: 0, height: 0, tileWidth: 0, tileHeight: 0 };
      pages.set(a[0], page);
      creature = "";
    } else if (
      tag === "CREATURE_GRAPHICS" ||
      tag === "CREATURE_CASTE_GRAPHICS"
    ) {
      creature = a.join(":");
      layered = false;
      page = undefined;
    } else if (tag === "LAYER_SET") layered = true;
    else if (page) {
      if (tag === "FILE") page.file = a[0];
      if (tag === "TILE_DIM") {
        page.tileWidth = Number(a[0]);
        page.tileHeight = Number(a[1]);
      }
      if (tag === "PAGE_DIM_PIXELS") {
        page.width = Number(a[0]);
        page.height = Number(a[1]);
      }
      if (tag === "PAGE_DIM") {
        page.width = Number(a[0]) * page.tileWidth;
        page.height = Number(a[1]) * page.tileHeight;
      }
    } else if (
      creature &&
      !layered &&
      tag === "DEFAULT" &&
      a.length === 4 &&
      a[3] === "AS_IS" &&
      a.slice(1, 3).every((v) => /^\d+$/.test(v))
    )
      sprites.set(creature, { page: a[0], x: Number(a[1]), y: Number(a[2]) });
  }
  return { pages, sprites };
}
export function parseYakBodies(text: string) {
  const block = text.match(
    /\[CREATURE_GRAPHICS:YAK\]([\s\S]*?)(?=\[CREATURE(?:_CASTE)?_GRAPHICS:|$)/,
  )?.[1];
  const out = new Map<string, { page: string; x: number; y: number }>();
  if (!block) return out;
  const set = parseDwarfLayers(block).find((s) => s.state === "DEFAULT");
  for (const l of set?.groups.flat() ?? []) {
    const child = l.name === "CBODY";
    if (
      (!child && l.name !== "BODY") ||
      l.width !== 1 ||
      l.height !== 1 ||
      l.conditions.length !== 1 ||
      l.conditions[0].length !== 1 ||
      l.conditions[0][0] !== (child ? "CONDITION_CHILD" : "CONDITION_NOT_CHILD")
    )
      continue;
    out.set(`YAK:${child ? "CHILD" : "ADULT"}`, {
      page: l.page,
      x: l.x,
      y: l.y,
    });
  }
  return out;
}
export async function permittedImage(root: string, relative: string) {
  if (
    !relative.startsWith("images/") ||
    !relative.endsWith(".png") ||
    relative.includes("\\") ||
    relative.split("/").some((p) => p === ".." || p === "")
  )
    throw Error("Invalid local graphics path");
  const base = await realpath(root),
    file = await realpath(path.resolve(root, relative));
  if (!file.startsWith(base + path.sep))
    throw Error("Local graphics escape permitted root");
  return file;
}
export class Graphics {
  dwarfSets: LayerSet[] = [];
  private dwarfPages = new Map<string, SpriteRef>();
  private paletteAssets = new Map<string, string>();
  files = new Map<string, string>();
  refs = new Map<string, SpriteRef>();
  async load(installation: string) {
    // Explicit vanilla profile, not a guess at active mod override precedence.
    const root = path.join(
      installation,
      "data/vanilla/vanilla_creatures_graphics/graphics",
    );
    const pages = new Map<string, Page>(),
      sprites = new Map<string, { page: string; x: number; y: number }>();
    const duplicatePages = new Set<string>(),
      duplicateSprites = new Set<string>();
    for (const file of await readdir(root)) {
      if (!file.endsWith(".txt")) continue;
      const source = await readFile(path.join(root, file), "utf8");
      const parsed = parseGraphics(source);
      for (const [id, body] of parseYakBodies(source))
        parsed.sprites.set(id, body);
      for (const [id, p] of parsed.pages) {
        if (pages.has(id)) duplicatePages.add(id);
        pages.set(id, p);
      }
      for (const [id, s] of parsed.sprites) {
        if (sprites.has(id)) duplicateSprites.add(id);
        sprites.set(id, s);
      }
    }
    for (const [id, s] of sprites) {
      const p = pages.get(s.page);
      if (!p || duplicatePages.has(s.page) || duplicateSprites.has(id))
        continue;
      if (
        ![p.width, p.height, p.tileWidth, p.tileHeight].every(
          (n) => Number.isInteger(n) && n > 0 && n <= 16384,
        ) ||
        s.x * p.tileWidth + p.tileWidth > p.width ||
        s.y * p.tileHeight + p.tileHeight > p.height
      )
        continue;
      const file = await permittedImage(root, p.file),
        asset = createHash("sha256").update(file).digest("hex").slice(0, 24);
      this.files.set(asset, file);
      this.refs.set(id, {
        asset,
        x: s.x * p.tileWidth,
        y: s.y * p.tileHeight,
        width: p.tileWidth,
        height: p.tileHeight,
        pageWidth: p.width,
        pageHeight: p.height,
      });
    }
    this.dwarfSets = parseDwarfLayers(
      await readFile(path.join(root, "graphics_creatures_dwarf.txt"), "utf8"),
    );
    const needed = new Set(
      this.dwarfSets.flatMap((s) =>
        s.groups.flatMap((g) => g.map((l) => l.page)),
      ),
    );
    for (const id of needed) {
      const p = pages.get(id);
      if (!p || duplicatePages.has(id)) continue;
      const file = await permittedImage(root, p.file),
        asset = createHash("sha256").update(file).digest("hex").slice(0, 24);
      this.files.set(asset, file);
      this.dwarfPages.set(id, {
        asset,
        x: 0,
        y: 0,
        width: p.tileWidth,
        height: p.tileHeight,
        pageWidth: p.width,
        pageHeight: p.height,
      });
    }
    for (const set of this.dwarfSets)
      for (const p of set.palettes.values()) {
        const file = await permittedImage(root, p.file),
          asset = createHash("sha256").update(file).digest("hex").slice(0, 24);
        this.files.set(asset, file);
        this.paletteAssets.set(p.file, asset);
      }
  }
  dwarf(appearance: DwarfAppearance) {
    return chooseDwarfLayers(
      this.dwarfSets,
      appearance,
      (id, x, y, w, h) => {
        const base = this.dwarfPages.get(id);
        if (!base) return;
        const ref = {
          ...base,
          x: x * base.width,
          y: y * base.height,
          width: w * base.width,
          height: h * base.height,
        };
        return ref.x >= 0 &&
          ref.y >= 0 &&
          ref.width > 0 &&
          ref.height > 0 &&
          ref.x + ref.width <= ref.pageWidth &&
          ref.y + ref.height <= ref.pageHeight
          ? ref
          : undefined;
      },
      (file) => this.paletteAssets.get(file),
    );
  }
  resolve(race: string, caste: string, age?: number) {
    // Vanilla yak CHILD:1; pack equipment is not part of this body fallback.
    if (race === "YAK")
      return this.refs.get(
        `YAK:${age !== undefined && age < 1 ? "CHILD" : "ADULT"}`,
      );
    return this.refs.get(`${race}:${caste}`) ?? this.refs.get(race);
  }
}
