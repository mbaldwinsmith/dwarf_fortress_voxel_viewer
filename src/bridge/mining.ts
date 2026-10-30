import type { FortressAdapter } from "./adapter.js";
import type { MiningRequest } from "../shared/mining.js";
import type { Chunk } from "../shared/model.js";
export function miningArguments(
  request: MiningRequest,
  save: string,
  dry: boolean,
  expected?: number,
) {
  const args = [
    request.x,
    request.y,
    request.z,
    request.operation,
    request.mode,
    save,
    String(dry),
    expected ?? "",
  ].map(String);
  if (request.x2 !== undefined)
    args.push(String(request.x2), String(request.y2));
  return args;
}
export async function mineTile(
  adapter: FortressAdapter,
  request: MiningRequest,
  current: () => boolean,
  onRefresh?: (chunks: Chunk[]) => void,
) {
  await adapter.checkWorld();
  const cx = Math.floor(request.x / 16) * 16,
    cy = Math.floor(request.y / 16) * 16;
  // The fixed Lua preflight validates fresh terrain, visibility and occupancy.
  // Avoid a redundant fully decorated column read before that native check.
  const save = JSON.parse(adapter.identity).saveName;
  if (typeof save !== "string" || !save)
    throw Error("Fortress identity is unavailable");
  const prepared = await adapter.rpc.mining(
    miningArguments(request, save, true),
  );
  if (prepared.state !== "READY" || !current())
    throw Error("Mining action is no longer current");
  await adapter.checkWorld();
  if (!current()) throw Error("Mining action was cancelled");
  const result = await adapter.rpc.mining(
    miningArguments(request, save, false, prepared.tiletype),
  );
  if (result.state !== "DUG" && result.state !== "DESIGNATED")
    throw Error("Mining was not applied");
  await adapter.checkWorld();
  const refresh = [];
  const rectangle = request.x2 !== undefined;
  const xs = rectangle
    ? Array.from(
        { length: Math.abs(Math.floor(request.x2! / 16) * 16 - cx) / 16 + 1 },
        (_, i) => Math.min(cx, Math.floor(request.x2! / 16) * 16) + i * 16,
      )
    : [cx - 16, cx, cx + 16];
  const ys = rectangle
    ? Array.from(
        { length: Math.abs(Math.floor(request.y2! / 16) * 16 - cy) / 16 + 1 },
        (_, i) => Math.min(cy, Math.floor(request.y2! / 16) * 16) + i * 16,
      )
    : [cy - 16, cy, cy + 16];
  const columns = xs.flatMap((x) => ys.map((y) => ({ x, y })));
  // Send the camera's edited column before reading the surrounding ring.
  columns.sort(
    (a, b) =>
      Math.abs(a.x - cx) +
      Math.abs(a.y - cy) -
      (Math.abs(b.x - cx) + Math.abs(b.y - cy)),
  );
  for (const { x, y } of columns) {
    if (
      x < adapter.bounds.x ||
      y < adapter.bounds.y ||
      x >= adapter.bounds.x + adapter.bounds.width ||
      y >= adapter.bounds.y + adapter.bounds.depth
    )
      continue;
    const levels = (
      rectangle ? [request.z] : [request.z - 1, request.z, request.z + 1]
    ).filter(
      (z) =>
        z >= adapter.bounds.z && z < adapter.bounds.z + adapter.bounds.height,
    );
    const updated = await adapter.column(x, y, levels);
    updated.sort(
      (a, b) => Math.abs(a.z - request.z) - Math.abs(b.z - request.z),
    );
    await adapter.checkWorld();
    if (!current()) throw Error("Mining action is no longer current");
    refresh.push(...updated);
    onRefresh?.(updated);
  }
  return {
    state: result.state,
    chunks: refresh,
    count: rectangle ? result.tiletype : undefined,
  };
}
