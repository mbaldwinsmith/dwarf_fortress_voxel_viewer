import { tileAt, type Chunk, type Bounds } from "./model.js";
export type MiningMode = "inspect" | "dig" | "designate";
export type MiningOperation = "mine" | "channel" | "ceiling" | "remove-ramp";
export function miningOperation(
  shape: string,
  normalY: number,
): MiningOperation {
  if (shape === "ramp") return "remove-ramp";
  if (normalY < -0.5) return "ceiling";
  return shape === "wall" ? "mine" : "channel";
}
export interface MiningTarget {
  x: number;
  y: number;
  z: number;
  operation: MiningOperation;
  x2?: number;
  y2?: number;
}
export function validDesignationRectangle(p: MiningTarget) {
  const width = Math.abs((p.x2 ?? p.x) - p.x) + 1,
    depth = Math.abs((p.y2 ?? p.y) - p.y) + 1;
  return width <= 64 && depth <= 64 && width * depth <= 1024;
}
export interface MiningRequest extends MiningTarget {
  type: "mining";
  id: number;
  session: string;
  mode: "dig" | "designate";
}
export const MINING_DELAY_MS = 750;
export function validMiningTile(chunks: Map<string, Chunk>, p: MiningTarget) {
  const tile = tileAt(chunks, p.x, p.y, p.z);
  return (
    !!tile &&
    tile.shape !== "unknown" &&
    !tile.treeGraphic &&
    tile.material !== 7 &&
    (p.operation === "mine"
      ? tile.shape === "wall"
      : p.operation === "remove-ramp"
        ? tile.shape === "ramp"
        : ["wall", "floor", "ramp", "stairs"].includes(tile.shape))
  );
}
export function parseMiningRequest(
  value: unknown,
  bounds: Bounds,
  session: string,
): MiningRequest | undefined {
  if (!value || typeof value !== "object") return;
  const m = value as MiningRequest;
  if (m.x2 !== undefined || m.y2 !== undefined) {
    if (
      m.mode !== "designate" ||
      ![m.x2, m.y2].every(Number.isInteger) ||
      !validDesignationRectangle(m) ||
      m.x2! < bounds.x ||
      m.y2! < bounds.y ||
      m.x2! >= bounds.x + bounds.width ||
      m.y2! >= bounds.y + bounds.depth
    )
      return;
  }
  if (
    m.type !== "mining" ||
    m.session !== session ||
    !Number.isSafeInteger(m.id) ||
    m.id < 1 ||
    ![m.x, m.y, m.z].every(Number.isInteger) ||
    !["dig", "designate"].includes(m.mode) ||
    !["mine", "channel", "ceiling", "remove-ramp"].includes(m.operation) ||
    m.x <= bounds.x ||
    m.y <= bounds.y ||
    m.x >= bounds.x + bounds.width - 1 ||
    m.y >= bounds.y + bounds.depth - 1 ||
    m.z <= bounds.z ||
    m.z >= bounds.z + bounds.height - 1
  )
    return;
  return m;
}
export class MiningHold {
  private start = 0;
  private key = "";
  begin(target: MiningTarget, now: number) {
    this.start = now;
    this.key = JSON.stringify(target);
  }
  cancel() {
    this.key = "";
  }
  get active() {
    return !!this.key;
  }
  progress(target: MiningTarget | undefined, now: number) {
    if (!target || JSON.stringify(target) !== this.key) {
      this.cancel();
      return 0;
    }
    return Math.min(1, Math.max(0, (now - this.start) / MINING_DELAY_MS));
  }
}
