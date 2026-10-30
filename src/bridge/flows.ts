import type { Chunk, FlowEffect } from "../shared/model.js";
const kinds: Record<number, FlowEffect["kind"]> = {
  [-1]: "fire",
  0: "miasma",
  1: "steam",
  2: "mist",
  3: "dust",
  4: "magma-mist",
  5: "smoke",
  6: "dragonfire",
  7: "fire",
  9: "gas",
  10: "vapor",
  13: "item-cloud",
};
export const flowTokens: Record<FlowEffect["kind"], string> = {
  smoke: "FLOW_SMOKE",
  mist: "FLOW_WATER_MIST",
  steam: "FLOW_BOILING",
  fire: "FLOW_FIRE",
  dragonfire: "FLOW_DRAGONFIRE",
  "magma-mist": "FLOW_LAVA_MIST",
  miasma: "FLOW_MIASMA",
  dust: "FLOW_DUST",
  gas: "FLOW_VAPOR",
  vapor: "FLOW_VAPOR",
  "item-cloud": "FLOW_ITEM",
};
export function visibleFlows(raw: unknown, chunk: Chunk): FlowEffect[] {
  if (!Array.isArray(raw)) return [];
  const out: FlowEffect[] = [];
  for (const f of raw.slice(0, 4096)) {
    const p = f?.pos,
      kind = kinds[Number(f?.type)];
    if (
      !p ||
      !kind ||
      f.dead === true ||
      ![p.x, p.y, p.z, f.density].every(Number.isSafeInteger) ||
      f.density <= 0 ||
      f.density > 100 ||
      p.x < chunk.x ||
      p.x >= chunk.x + 16 ||
      p.y < chunk.y ||
      p.y >= chunk.y + 16 ||
      p.z !== chunk.z
    )
      continue;
    const tile = chunk.tiles[(p.y - chunk.y) * 16 + p.x - chunk.x];
    if (!tile || tile.shape === "unknown") continue;
    out.push({ x: p.x, y: p.y, z: p.z, kind, density: f.density });
    if (out.length === 256) break;
  }
  return out;
}
