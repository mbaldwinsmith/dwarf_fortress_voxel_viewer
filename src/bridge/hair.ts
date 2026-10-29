import type { HairAppearance } from "./dwarf-layers.js";
const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
export function hairAppearance(
  caste: Record<string, unknown>,
  appearance: Record<string, unknown>,
  age: number,
) {
  const parts = records(caste.bodyParts),
    modifiers = records(caste.modifiers),
    colors = records(caste.colorModifiers),
    indices = Array.isArray(caste.modifierIdx) ? caste.modifierIdx : [],
    values = Array.isArray(appearance.bpModifiers)
      ? appearance.bpModifiers
      : [],
    colorValues = Array.isArray(appearance.colors) ? appearance.colors : [];
  const result: { hair?: HairAppearance; beard?: HairAppearance } = {};
  for (const [field, tissueName] of [
    ["hair", "HAIR"],
    ["beard", "CHIN_WHISKERS"],
  ] as const) {
    const style = appearance[field];
    if (!style || typeof style !== "object") continue;
    const h = style as Record<string, unknown>;
    if (
      typeof h.length !== "number" ||
      !Number.isInteger(h.length) ||
      h.length < 0 ||
      typeof h.style !== "number" ||
      ![-1, 0, 1, 2, 3, 4].includes(h.style)
    )
      continue;
    let color = "",
      curly: number | undefined,
      latestStart = -1;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      if (p.category !== "HEAD") continue;
      const layers = records(p.layers);
      for (let li = 0; li < layers.length; li++) {
        const l = layers[li];
        if (l.layerName !== tissueName) continue;
        for (const i of Array.isArray(l.bpModifiers) ? l.bpModifiers : []) {
          const type = modifiers[Number(indices[Number(i)])]?.type,
            value = values[Number(i)];
          if (
            type === "CURLY" &&
            typeof value === "number" &&
            Number.isFinite(value)
          )
            curly = value;
        }
        for (let ci = 0; ci < colors.length; ci++) {
          const m = colors[ci],
            partIds = m.bodyPartId,
            layerIds = m.tissueLayerId;
          if (
            !Array.isArray(partIds) ||
            !Array.isArray(layerIds) ||
            !partIds.some((id, k) => id === pi && layerIds[k] === li)
          )
            continue;
          const start = Number(m.startDate ?? 0);
          if (
            !Number.isFinite(start) ||
            start > age * 336 ||
            start < latestStart
          )
            continue;
          const index = colorValues[ci],
            pattern =
              typeof index === "number"
                ? records(m.patterns)[index]
                : undefined;
          if (typeof pattern?.id === "string") {
            color = pattern.id;
            latestStart = start;
          }
        }
      }
    }
    // Never substitute a guessed hair colour when the actual pattern is unavailable.
    if (color)
      result[field] = {
        length: h.length,
        style: h.style,
        color,
        ...(curly !== undefined ? { curly } : {}),
      };
  }
  return result;
}
