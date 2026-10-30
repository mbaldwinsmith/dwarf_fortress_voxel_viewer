import type { FortressAdapter } from "./adapter.js";
import { validMiningTile, type MiningRequest } from "../shared/mining.js";
export function miningArguments(
  request: MiningRequest,
  save: string,
  dry: boolean,
  expected?: number,
) {
  return [
    request.x,
    request.y,
    request.z,
    request.operation,
    request.mode,
    save,
    String(dry),
    expected ?? "",
  ].map(String);
}
export async function mineTile(
  adapter: FortressAdapter,
  request: MiningRequest,
  current: () => boolean,
) {
  await adapter.checkWorld();
  const cx = Math.floor(request.x / 16) * 16,
    cy = Math.floor(request.y / 16) * 16;
  const chunk = await adapter.block(cx, cy, request.z);
  if (!validMiningTile(new Map([[`${cx},${cy},${request.z}`, chunk]]), request))
    throw Error("Select revealed natural terrain");
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
  for (const x of [cx - 16, cx, cx + 16])
    for (const y of [cy - 16, cy, cy + 16]) {
      if (
        x < adapter.bounds.x ||
        y < adapter.bounds.y ||
        x >= adapter.bounds.x + adapter.bounds.width ||
        y >= adapter.bounds.y + adapter.bounds.depth
      )
        continue;
      const levels = [request.z - 1, request.z, request.z + 1].filter(
        (z) =>
          z >= adapter.bounds.z && z < adapter.bounds.z + adapter.bounds.height,
      );
      refresh.push(...(await adapter.column(x, y, levels)));
    }
  await adapter.checkWorld();
  return { state: result.state, chunks: refresh };
}
