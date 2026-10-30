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
export interface SpriteDefinition {
  page: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}
function spriteDefinition(args: string[]): SpriteDefinition | undefined {
  const large = args[1] === "LARGE_IMAGE";
  const n = large ? 2 : 1,
    count = large ? 6 : 3;
  if (
    args.length !== count &&
    !(args.length === count + 1 && args[count] === "AS_IS")
  )
    return;
  if (!args.slice(n, count).every((v) => /^\d+$/.test(v))) return;
  const x = Number(args[n]),
    y = Number(args[n + 1]);
  if (!large) return { page: args[0], x, y };
  const width = Number(args[4]) - x + 1,
    height = Number(args[5]) - y + 1;
  if (width < 1 || height < 1) return;
  return { page: args[0], x, y, width, height };
}
export function parseGraphics(text: string) {
  const pages = new Map<string, Page>(),
    sprites = new Map<string, SpriteDefinition>();
  const priorities = new Map<string, number>();
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
    } else if (tag.startsWith("STATUE_") && tag.endsWith("_GRAPHICS")) {
      creature = "";
      page = undefined;
      layered = false;
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
    } else if (creature && !layered) {
      const child = tag === "CHILD";
      const parent = child ? a.at(-1) : tag;
      const priority =
        parent === "DEFAULT"
          ? 3
          : parent === "VERMIN"
            ? 2
            : parent === "ANIMATED"
              ? 1
              : 0;
      if (
        !priority ||
        !(child || ["DEFAULT", "VERMIN", "ANIMATED"].includes(tag))
      )
        continue;
      const sprite = spriteDefinition(child ? a.slice(0, -1) : a);
      const id = creature + (child ? ":CHILD" : "");
      if (sprite && priority > (priorities.get(id) ?? 0)) {
        sprites.set(id, sprite);
        priorities.set(id, priority);
      }
    }
  }
  return { pages, sprites };
}
export function parseCreatureBodies(text: string) {
  const out = new Map<string, SpriteDefinition>();
  const headers = [
    ...text.matchAll(/\[CREATURE(?:_CASTE)?_GRAPHICS:([^\]]+)\]/g),
  ];
  for (const [i, header] of headers.entries()) {
    const block = text.slice(
      header.index! + header[0].length,
      headers[i + 1]?.index ?? text.length,
    );
    const set = parseDwarfLayers(block).find((s) => s.state === "DEFAULT");
    for (const layer of set?.groups.flat() ?? []) {
      const child = layer.name === "CBODY";
      if (
        (!child && layer.name !== "BODY") ||
        layer.palette ||
        layer.itemPalette ||
        layer.conditions.length !== 1 ||
        layer.conditions[0].length !== 1 ||
        layer.conditions[0][0] !==
          (child ? "CONDITION_CHILD" : "CONDITION_NOT_CHILD")
      )
        continue;
      out.set(`${header[1]}:${child ? "CHILD" : "ADULT"}`, {
        page: layer.page,
        x: layer.x,
        y: layer.y,
        ...(layer.width !== 1 || layer.height !== 1
          ? { width: layer.width, height: layer.height }
          : {}),
      });
    }
  }
  return out;
}
export function parseYakBodies(text: string) {
  return new Map(
    [...parseCreatureBodies(text)].filter(([id]) => id.startsWith("YAK:")),
  );
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
      sprites = new Map<string, SpriteDefinition>();
    const duplicatePages = new Set<string>(),
      duplicateSprites = new Set<string>();
    for (const file of await readdir(root)) {
      if (!file.endsWith(".txt")) continue;
      const source = await readFile(path.join(root, file), "utf8");
      const parsed = parseGraphics(source);
      for (const [id, body] of parseCreatureBodies(source))
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
        ![s.x, s.y, s.width ?? 1, s.height ?? 1].every(Number.isInteger) ||
        s.x < 0 ||
        s.y < 0 ||
        (s.width ?? 1) < 1 ||
        (s.height ?? 1) < 1 ||
        (s.x + (s.width ?? 1)) * p.tileWidth > p.width ||
        (s.y + (s.height ?? 1)) * p.tileHeight > p.height
      )
        continue;
      const file = await permittedImage(root, p.file),
        asset = createHash("sha256").update(file).digest("hex").slice(0, 24);
      this.files.set(asset, file);
      this.refs.set(id, {
        asset,
        x: s.x * p.tileWidth,
        y: s.y * p.tileHeight,
        width: p.tileWidth * (s.width ?? 1),
        height: p.tileHeight * (s.height ?? 1),
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
    const keys = [`${race}:${caste}`, race];
    if (age !== undefined && age < 1)
      for (const id of keys) {
        const child = this.refs.get(`${id}:CHILD`);
        if (child) return child;
      }
    for (const id of keys) {
      const adult = this.refs.get(`${id}:ADULT`) ?? this.refs.get(id);
      if (adult) return adult;
    }
  }
}
