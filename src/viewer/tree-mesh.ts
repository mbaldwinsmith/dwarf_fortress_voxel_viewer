import type { Chunk, Tile } from "../shared/model.js";
import type { MeshData } from "./mesh.js";
import type { TreeUV } from "./tree-geometry.js";
import { appendTreeWood } from "./tree-wood.js";
import { appendTreeFoliage } from "./tree-foliage.js";
import { TreeTopology } from "./tree-topology.js";
import { appendFungalStem, roundFungalStem } from "./fungi-stems.js";
import { appendFungalBranches, roundFungalBranches } from "./fungi-branches.js";

export function appendTree(
  out: MeshData,
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
  uv: TreeUV,
  topology: TreeTopology,
) {
  if (t.shape === "unknown" || !t.treeGraphic || /CAP/.test(t.treeGraphic))
    return;
  const stem = roundFungalStem(t),
    branches = roundFungalBranches(t);
  const firstColor = out.colors.length;
  if (stem) appendFungalStem(out, t, x, y, z, chunks, uv);
  if (branches) appendFungalBranches(out, t, x, y, z, chunks, uv);
  if (!stem && !branches) appendTreeWood(out, t, x, y, z, chunks, uv, topology);
  if (!t.tree?.bark && !t.tree?.side)
    for (let i = firstColor; i < out.colors.length; i++)
      out.colors[i] *= [0.39, 0.27, 0.16][i % 3];
  appendTreeFoliage(out, t, x, y, z, uv, chunks);
}
export function buildTreeMesh(
  c: Chunk,
  chunks: Map<string, Chunk>,
  uv: TreeUV,
): MeshData {
  const out: MeshData = { positions: [], colors: [], uvs: [] },
    topology = new TreeTopology(chunks);
  for (let i = 0; i < 256; i++) {
    const t = c.tiles[i];
    if (t)
      appendTree(
        out,
        t,
        c.x + (i % 16),
        c.y + Math.floor(i / 16),
        c.z,
        chunks,
        uv,
        topology,
      );
  }
  return out;
}
