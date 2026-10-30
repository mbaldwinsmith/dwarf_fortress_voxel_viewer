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
  offset?: [number, number];
}
export interface LayerSet {
  state: string;
  context?: string;
  groups: LayerDefinition[][];
  palettes: Map<string, { file: string; sourceRow: number }>;
}
export function parseDwarfLayers(text: string): LayerSet[] {
  const sets: LayerSet[] = [];
  let set: LayerSet | undefined,
    group: LayerDefinition[] | undefined,
    layer: LayerDefinition | undefined,
    palette: string | undefined;
  let permitted = true,
    offset: [number, number] = [0, 0];
  for (const m of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
    const [tag, ...a] = m[1].split(":");
    if (tag === "LAYER_SET") {
      set = { state: a[0], groups: [], palettes: new Map() };
      if (a[1]) set.context = a[1];
      sets.push(set);
      permitted = true;
      offset = [0, 0];
      palette = undefined;
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
      permitted = true;
      offset = [0, 0];
      group = [];
      set.groups.push(group);
      layer = undefined;
    } else if (tag === "LG_PERMITTED") {
      permitted = a[0] === "YES";
    } else if (tag === "LG_OFFSET") {
      const values = a.map(Number);
      if (
        values.length !== 2 ||
        !values.every((v) => Number.isInteger(v) && Math.abs(v) <= 512)
      )
        permitted = false;
      else offset = values as [number, number];
    } else if (tag === "END_LAYER_GROUP") {
      group = undefined;
      layer = undefined;
      permitted = true;
      offset = [0, 0];
    } else if (tag === "LAYER") {
      if (!permitted) {
        layer = undefined;
        continue;
      }
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
        ...(offset.some((v) => v !== 0)
          ? { offset: [...offset] as [number, number] }
          : {}),
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
  mode?: number;
  materialFlags?: string[];
  materialType?: string;
}
export interface HairAppearance {
  length: number;
  style: number;
  color: string;
  curly?: number;
}
export interface DwarfAppearance {
  variantSeed?: number;
  faceVariant?: number;
  eyeColor?: [number, number, number];
  hair?: HairAppearance;
  beard?: HairAppearance;
  caste: string;
  age: number;
  skin: string;
  items: WornItem[];
  state?: string;
  professionCategories?: string[];
  bodySize?: number;
  haulCount?: number;
  ghost?: boolean;
  syndromeClasses?: string[];
}
function matchItem(a: string[], item: WornItem) {
  const [by, ...args] = a;
  const hauled = by === "ANY_HAULED" || by === "WIELD";
  const [body, type, ...subtypes] = hauled ? ["", ...args] : args;
  const attachment = hauled
    ? item.mode === (by === "WIELD" ? 1 : 0)
    : by === "BY_CATEGORY"
      ? item.bodyCategory === body
      : by === "BY_TOKEN" && item.bodyToken === body;
  return (
    attachment &&
    item.type === type &&
    (subtypes.length === 0 ||
      subtypes.includes("ANY") ||
      subtypes.includes(item.subtype))
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
  // Native profession state supplies species-specific life stages. Age remains
  // the legacy dwarf fallback when a caller has no native profession record.
  const state =
      appearance.state ??
      (appearance.age < 1 ? "BABY" : appearance.age < 18 ? "CHILD" : "DEFAULT"),
    set =
      sets.find((s) => s.state === state) ??
      sets.find((s) => s.state === "DEFAULT");
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
      const tissueRule = layer.conditions.find(
        (c) => c[0] === "CONDITION_TISSUE_LAYER",
      );
      const tissue =
        tissueRule?.[3] === "HAIR"
          ? appearance.hair
          : tissueRule?.[3] === "CHIN_WHISKERS"
            ? appearance.beard
            : undefined;
      let image = {
        page: layer.page,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      };
      for (const [tag, ...a] of layer.conditions) {
        if (tag === "CONDITION_ITEM_WORN") continue;
        if (tag === "CONDITION_PROFESSION_CATEGORY")
          ok &&= a.some((c) => appearance.professionCategories?.includes(c));
        else if (tag === "CONDITION_BODY_SIZE_MIN")
          ok &&= (appearance.bodySize ?? 0) >= Number(a[0]);
        else if (tag === "CONDITION_HAUL_COUNT_MIN")
          ok &&= (appearance.haulCount ?? 0) >= Number(a[0]);
        else if (tag === "CONDITION_HAUL_COUNT_MAX")
          ok &&= (appearance.haulCount ?? 0) <= Number(a[0]);
        else if (tag === "CONDITION_CHILD")
          ok &&= state === "CHILD" || state === "BABY";
        else if (tag === "CONDITION_NOT_CHILD") ok &&= state === "DEFAULT";
        else if (tag === "CONDITION_GHOST") ok &&= !!appearance.ghost;
        else if (tag === "CONDITION_SYN_CLASS")
          ok &&= a.some((c) => appearance.syndromeClasses?.includes(c));
        else if (tag === "CONDITION_MATERIAL_TYPE")
          ok &&= !!matched && a.includes(matched.materialType ?? "");
        else if (tag === "CONDITION_CASTE") ok &&= a.includes(appearance.caste);
        else if (tag === "CONDITION_TISSUE_LAYER")
          ok &&=
            a[0] === "BY_CATEGORY" &&
            ((a[1] === "ALL" && a[2] === "SKIN") ||
              (a[1] === "HEAD" &&
                !!tissue &&
                tissue.length > 0 &&
                tissue.style !== 4));
        else if (tag === "TISSUE_MAY_HAVE_COLOR")
          ok &&= a.includes(tissue?.color ?? appearance.skin);
        else if (tag === "TISSUE_MIN_LENGTH")
          ok &&= !!tissue && tissue.length >= Number(a[0]);
        else if (tag === "TISSUE_MAX_LENGTH")
          ok &&= !!tissue && tissue.length <= Number(a[0]);
        else if (tag === "TISSUE_NOT_SHAPED") ok &&= tissue?.style === -1;
        else if (tag === "TISSUE_MAY_HAVE_SHAPING")
          ok &&=
            !!tissue &&
            a.includes(
              (
                {
                  "0": "NEATLY_COMBED",
                  "1": "BRAIDED",
                  "2": "DOUBLE_BRAIDS",
                  "3": "PONY_TAILS",
                } as Record<string, string>
              )[String(tissue.style)],
            );
        else if (tag === "TISSUE_SWAP") {
          if (a[0] !== "IF_MIN_CURLY") ok = false;
          else if (
            tissue?.curly !== undefined &&
            tissue.curly >= Number(a[1])
          ) {
            const large = a[3] === "LARGE_IMAGE",
              n = large ? 4 : 3,
              x = Number(a[n]),
              y = Number(a[n + 1]);
            image = {
              page: a[2],
              x,
              y,
              width: large ? Number(a[n + 2]) - x + 1 : 1,
              height: large ? Number(a[n + 3]) - y + 1 : 1,
            };
          }
        }
        // RFR omits the game's index; the bridge supplies a stable artistic variant.
        else if (tag === "CONDITION_RANDOM_PART_INDEX") {
          const count = Number(a[2]);
          let seed = appearance.variantSeed ?? 0;
          for (const character of a[0])
            seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
          const variant =
            a[0] === "HEAD" && count === 4
              ? (appearance.faceVariant ?? 1)
              : ((seed >>> 0) % count) + 1;
          ok &&=
            Number.isInteger(count) && count > 0 && Number(a[1]) === variant;
        } else if (tag === "CONDITION_MATERIAL_FLAG")
          ok &&=
            !!matched &&
            a.every((flag) =>
              flag === "NOT_ARTIFACT"
                ? !matched.artifact
                : flag === "IS_CRAFTED_ARTIFACT"
                  ? !!matched.artifact
                  : (matched.materialFlags?.includes(flag) ?? false),
            );
        else if (tag === "SHUT_OFF_IF_ITEM_PRESENT")
          ok &&= !appearance.items.some((i) => matchItem(a, i));
        else ok = false; // Unknown/special conditions fail closed, not silently applied.
      }
      if (!ok) continue;
      const sprite = resolve(
        image.page,
        image.x,
        image.y,
        image.width,
        image.height,
      );
      if (!sprite) continue;
      const out: SpriteLayer = {
        sprite,
        ...(layer.offset ? { offset: layer.offset } : {}),
      };
      // This mask is specific to the inspected vanilla adult/child face rows. Do not
      // tint black outlines, wearables, babies or arbitrary mod graphics.
      if (
        appearance.eyeColor &&
        [
          "DWARF_BODY",
          "HUMAN_BODY",
          "ELF_BODY",
          "GOBLIN_BODY",
          "KOBOLD_BODY",
        ].includes(layer.page) &&
        (layer.y === 0 || layer.y === 3) &&
        layer.x >= 0 &&
        layer.x <= 7 &&
        layer.conditions.some((c) => c[0] === "CONDITION_RANDOM_PART_INDEX")
      )
        out.eyeColor = appearance.eyeColor;
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
