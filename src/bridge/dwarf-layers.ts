import type { SpriteLayer, SpriteRef } from "../shared/model.js";
export interface LayerDefinition {
  name: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
  conditions: string[][];
  palette?: { name: string; row: number };
  itemPalette: boolean;
}
export interface LayerSet {
  state: string;
  groups: LayerDefinition[][];
  palettes: Map<string, { file: string; sourceRow: number }>;
}
export function parseDwarfLayers(text: string): LayerSet[] {
  const sets: LayerSet[] = [];
  let set: LayerSet | undefined,
    group: LayerDefinition[] | undefined,
    layer: LayerDefinition | undefined,
    palette: string | undefined;
  for (const m of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
    const [tag, ...a] = m[1].split(":");
    if (tag === "LAYER_SET") {
      set = { state: a[0], groups: [], palettes: new Map() };
      sets.push(set);
      group = undefined;
      layer = undefined;
    } else if (!set) continue;
    else if (tag === "LS_PALETTE") {
      palette = a[0];
      set.palettes.set(palette, { file: "", sourceRow: 0 });
    } else if (tag === "LS_PALETTE_FILE" && palette)
      set.palettes.get(palette)!.file = a[0];
    else if (tag === "LS_PALETTE_DEFAULT" && palette)
      set.palettes.get(palette)!.sourceRow = Number(a[0]);
    else if (tag === "LAYER_GROUP") {
      group = [];
      set.groups.push(group);
      layer = undefined;
    } else if (tag === "END_LAYER_GROUP") {
      group = undefined;
      layer = undefined;
    } else if (tag === "LAYER") {
      const large = a[2] === "LARGE_IMAGE",
        n = large ? 3 : 2,
        x = Number(a[n]),
        y = Number(a[n + 1]);
      layer = {
        name: a[0],
        page: a[1],
        x,
        y,
        width: large ? Number(a[5]) - x + 1 : 1,
        height: large ? Number(a[6]) - y + 1 : 1,
        conditions: [],
        itemPalette: false,
      };
      if (!group) {
        group = [];
        set.groups.push(group);
      }
      group.push(layer);
    } else if (layer) {
      if (tag === "USE_PALETTE")
        layer.palette = { name: a[0], row: Number(a[1]) };
      else if (tag === "USE_STANDARD_PALETTE_FROM_ITEM")
        layer.itemPalette = true;
      else layer.conditions.push([tag, ...a]);
    }
  }
  return sets;
}
export interface WornItem {
  type: string;
  subtype: string;
  bodyToken: string;
  bodyCategory: string;
  color?: [number, number, number];
  artifact?: boolean;
}
export interface DwarfAppearance {
  caste: string;
  age: number;
  skin: string;
  items: WornItem[];
}
function matchItem(a: string[], item: WornItem) {
  const [by, body, type, ...subtypes] = a;
  return (
    (by === "BY_CATEGORY"
      ? item.bodyCategory === body
      : by === "BY_TOKEN" && item.bodyToken === body) &&
    item.type === type &&
    (subtypes.includes("ANY") || subtypes.includes(item.subtype))
  );
}
export function chooseDwarfLayers(
  sets: LayerSet[],
  appearance: DwarfAppearance,
  resolve: (
    page: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => SpriteRef | undefined,
  paletteAsset: (file: string) => string | undefined,
): SpriteLayer[] {
  // Vanilla life stages are BABY:1 and CHILD:18. Other species do not use this evaluator.
  const state =
      appearance.age < 1 ? "BABY" : appearance.age < 18 ? "CHILD" : "DEFAULT",
    set = sets.find((s) => s.state === state);
  if (!set) return [];
  const layers: SpriteLayer[] = [];
  for (const group of set.groups) {
    for (const layer of group) {
      let matched: WornItem | undefined,
        ok = true;
      const itemConditions = layer.conditions.filter(
        (c) => c[0] === "CONDITION_ITEM_WORN",
      );
      if (itemConditions.length) {
        matched = appearance.items.find((i) =>
          itemConditions.some((c) => matchItem(c.slice(1), i)),
        );
        if (!matched) continue;
      }
      for (const [tag, ...a] of layer.conditions) {
        if (tag === "CONDITION_ITEM_WORN") continue;
        if (tag === "CONDITION_CASTE") ok &&= a.includes(appearance.caste);
        else if (tag === "CONDITION_TISSUE_LAYER")
          ok &&= a[0] === "BY_CATEGORY" && a[1] === "ALL" && a[2] === "SKIN";
        else if (tag === "TISSUE_MAY_HAVE_COLOR")
          ok &&= a.includes(appearance.skin);
        // RFR does not expose the game's random face index: use variant one.
        else if (tag === "CONDITION_RANDOM_PART_INDEX")
          ok &&= a[0] === "HEAD" && a[1] === "1";
        else if (tag === "CONDITION_MATERIAL_FLAG")
          ok &&=
            !!matched &&
            a.length === 1 &&
            (a[0] === "NOT_ARTIFACT"
              ? !matched.artifact
              : a[0] === "IS_CRAFTED_ARTIFACT"
                ? !!matched.artifact
                : false);
        else if (tag === "SHUT_OFF_IF_ITEM_PRESENT")
          ok &&= !appearance.items.some((i) => matchItem(a, i));
        else ok = false; // Unknown/special conditions fail closed, not silently applied.
      }
      if (!ok) continue;
      const sprite = resolve(
        layer.page,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
      );
      if (!sprite) continue;
      const out: SpriteLayer = { sprite };
      if (layer.palette) {
        const p = set.palettes.get(layer.palette.name),
          asset = p ? paletteAsset(p.file) : undefined;
        if (!p || !asset) continue;
        out.palette = { asset, sourceRow: p.sourceRow, row: layer.palette.row };
      }
      if (layer.itemPalette && matched?.color) out.tint = matched.color;
      layers.push(out);
      break;
    }
  }
  return layers.slice(0, 64);
}
