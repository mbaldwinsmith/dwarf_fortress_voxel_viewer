import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseGraphics, permittedImage } from "./graphics.js";
import type { SpriteRef, SpriteLayer } from "../shared/model.js";

export function sceneryMappings(text: string) {
  const entries: { key: string; page: string; x: number; y: number }[] = [];
  let plant = "",
    tool = "",
    ammo = "",
    weapon = "";
  for (const m of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
    const [tag, ...a] = m[1].split(":");
    if (tag === "WEAPON_GRAPHICS") weapon = a[0];
    if (
      weapon &&
      /^WEAPON_GRAPHICS_(DEFAULT|WOOD)$/.test(tag) &&
      a.length === 3 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: `${weapon}:${tag.endsWith("_WOOD") ? "WOOD" : "DEFAULT"}`,
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
    if (tag === "AMMO_GRAPHICS" || tag === "SIEGEAMMO_GRAPHICS") ammo = a[0];
    if (
      ammo &&
      /^(?:SIEGE)?AMMO_GRAPHICS_STRAIGHT_(DEFAULT|WOOD)$/.test(tag) &&
      a.length === 3 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: `${ammo}:${tag.endsWith("_WOOD") ? "WOOD" : "DEFAULT"}`,
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
    if (tag === "TOOL_GRAPHICS") tool = a.slice(3).join(":");
    if (
      tool &&
      tag === "TOOL_GRAPHICS_HIVE_BLD" &&
      a.length === 3 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: `${tool}_BUILDING`,
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
    if (
      /^TOOL_GRAPHICS_(WOOD|STONE|METAL|GLASS)$/.test(tag) &&
      tool &&
      a.length === 4 &&
      a[0] === "ALL" &&
      /^\d+$/.test(a[2]) &&
      /^\d+$/.test(a[3])
    )
      entries.push({
        key: `${tool}_${tag.slice(14)}`,
        page: a[1],
        x: Number(a[2]),
        y: Number(a[3]),
      });
    if (tag === "PLANT_GRAPHICS") plant = a[0];
    if (
      ["BOULDER_GRAPHICS", "ROUGH_GEM_GRAPHICS", "BARS_GRAPHICS"].includes(
        tag,
      ) &&
      a.length >= 4 &&
      /^\d+$/.test(a[1]) &&
      /^\d+$/.test(a[2])
    )
      entries.push({
        key: `${tag}:${a.slice(3).join(":")}`,
        page: a[0],
        x: Number(a[1]),
        y: Number(a[2]),
      });
    if (
      plant &&
      tag === "TREE_TILE" &&
      a.length === 4 &&
      /^\d+$/.test(a[2]) &&
      /^\d+$/.test(a[3])
    )
      entries.push({
        key: `PLANT:${plant}:${a[0]}`,
        page: a[1],
        x: Number(a[2]),
        y: Number(a[3]),
      });
    if (
      [
        "TILE_GRAPHICS",
        "TOOL_GRAPHICS",
        "ARMOR_GRAPHICS",
        "GLOVES_GRAPHICS",
        "HELM_GRAPHICS",
        "PANTS_GRAPHICS",
        "SHOES_GRAPHICS",
        "SHIELD_GRAPHICS",
        "TOY_GRAPHICS",
      ].includes(tag) &&
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
      [
        "SHRUB",
        "SHRUB_DEAD",
        "SAPLING",
        "SAPLING_DEAD",
        "GRASS_1",
        "GRASS_2",
        "GRASS_3",
        "GRASS_4",
      ].includes(tag) &&
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
  materialPalettes = new Map<string, NonNullable<SpriteLayer["palette"]>>();
  colorPalettes = new Map<string, NonNullable<SpriteLayer["palette"]>>();
  gemIds = new Set<string>();
  oreIds = new Set<string>();
  metalIds = new Set<string>();
  refs = new Map<string, SpriteRef>();
  constructor(private files: Map<string, string>) {}
  async load(installation: string) {
    const paletteRoot = path.join(
      installation,
      "data/vanilla/vanilla_descriptors_graphics/graphics",
    );
    const paletteText = (
      await readFile(path.join(paletteRoot, "palette_default.txt"), "utf8")
    ).split("[PALETTE:NEX_BODY]")[0];
    const paletteFile = await permittedImage(
      paletteRoot,
      "images/palettes.png",
    );
    const asset = createHash("sha256")
      .update(paletteFile)
      .digest("hex")
      .slice(0, 24);
    this.files.set(asset, paletteFile);
    const rows = new Map(
      [...paletteText.matchAll(/\[PALETTE_COLOR:([^:]+):(\d+)\]/g)].map((m) => [
        m[1],
        Number(m[2]),
      ]),
    );
    const rawRoot = path.join(
      installation,
      "data/vanilla/vanilla_materials/objects",
    );
    const colors = await readFile(
      path.join(
        installation,
        "data/vanilla/vanilla_descriptors/objects/descriptor_color_standard.txt",
      ),
      "utf8",
    );
    for (const m of colors.matchAll(
      /\[COLOR:([^\]]+)\]([\s\S]*?)(?=\[COLOR:|$)/g,
    )) {
      const rgb = /\[RGB:(\d+):(\d+):(\d+)\]/.exec(m[2]),
        row = rows.get(m[1]);
      if (rgb && row !== undefined)
        this.colorPalettes.set(rgb.slice(1).join(","), {
          asset,
          sourceRow: 0,
          row,
        });
    }
    const templates = new Map<string, string>();
    for (const name of (await readdir(rawRoot)).filter(
      (n) => n.startsWith("material_template_") && n.endsWith(".txt"),
    )) {
      const source = await readFile(path.join(rawRoot, name), "utf8");
      for (const m of source.matchAll(
        /\[MATERIAL_TEMPLATE:([^\]]+)\]([\s\S]*?)(?=\[MATERIAL_TEMPLATE:|$)/g,
      ))
        templates.set(m[1], m[2]);
    }
    for (const name of (await readdir(rawRoot)).filter(
      (n) => n.startsWith("inorganic_") && n.endsWith(".txt"),
    )) {
      const source = await readFile(path.join(rawRoot, name), "utf8");
      for (const m of source.matchAll(
        /\[INORGANIC:([^\]]+)\]([\s\S]*?)(?=\[INORGANIC:|$)/g,
      )) {
        const color = /\[STATE_COLOR:(?:ALL_SOLID|ALL):([^\]]+)\]/.exec(
          m[2],
        )?.[1];
        const row = color && rows.get(color);
        if (typeof row === "number")
          this.materialPalettes.set(`INORGANIC:${m[1]}`, {
            asset,
            sourceRow: 0,
            row,
          });
        if (/\[IS_GEM:/.test(m[2])) this.gemIds.add(`INORGANIC:${m[1]}`);
        if (/\[METAL_ORE:/.test(m[2])) this.oreIds.add(`INORGANIC:${m[1]}`);
        const inherited = [
          ...m[2].matchAll(/\[USE_MATERIAL_TEMPLATE:([^\]]+)\]/g),
        ]
          .map((t) => templates.get(t[1]) ?? "")
          .join("");
        if (/\[IS_METAL\]/.test(inherited + m[2]))
          this.metalIds.add(`INORGANIC:${m[1]}`);
      }
    }
    for (const module of [
      "vanilla_buildings_graphics",
      "vanilla_items_graphics",
      "vanilla_plants_graphics",
      "vanilla_environment",
      "vanilla_interface",
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
      const assets = new Map<string, { file: string; asset: string }>();
      for (const e of sceneryMappings(text)) {
        if (ambiguous.has(e.key)) continue;
        const p = pages.get(e.page);
        if (!p) continue;
        // Some optional environment variants use BMP; the asset endpoint serves PNG only.
        if (!p.file.endsWith(".png")) continue;
        if (
          ![p.width, p.height, p.tileWidth, p.tileHeight].every(
            (n) => Number.isInteger(n) && n > 0 && n <= 16384,
          )
        )
          continue;
        const x = e.x * p.tileWidth,
          y = e.y * p.tileHeight;
        if (x + p.tileWidth > p.width || y + p.tileHeight > p.height) continue;
        let location = assets.get(e.page);
        if (!location) {
          const file = await permittedImage(root, p.file);
          location = {
            file,
            asset: createHash("sha256").update(file).digest("hex").slice(0, 24),
          };
          assets.set(e.page, location);
        }
        const { file, asset } = location;
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
