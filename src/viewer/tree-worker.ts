import type { Chunk, SpriteRef } from "../shared/model.js";
import { buildTreeMesh } from "./tree-mesh.js";
export interface TreeJob {
  id: number;
  key: string;
  chunks: Chunk[];
}
export interface TreeResult {
  id: number;
  key: string;
  positions: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  refs: { ref?: SpriteRef; transparent: boolean }[];
}
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<TreeJob>) => void) | null;
  postMessage: (message: TreeResult, transfer: Transferable[]) => void;
};
worker.onmessage = ({ data: job }) => {
  const chunks = new Map(job.chunks.map((c) => [`${c.x},${c.y},${c.z}`, c])),
    refs: TreeResult["refs"] = [],
    slots = new Map<string, number>();
  const data = buildTreeMesh(
    chunks.get(job.key)!,
    chunks,
    (ref, transparent = false) => {
      const key = JSON.stringify([ref, transparent]);
      let slot = slots.get(key);
      if (slot === undefined) {
        slot = refs.length;
        slots.set(key, slot);
        refs.push({ ref, transparent });
      }
      // Two-unit intervals encode the material alongside its local UVs. The
      // main thread resolves atlas slots only after geometry has been built.
      return [slot * 2, 0, slot * 2 + 1, 1];
    },
  );
  const result: TreeResult = {
    id: job.id,
    key: job.key,
    positions: new Float32Array(data.positions),
    colors: new Float32Array(data.colors),
    uvs: new Float32Array(data.uvs),
    refs,
  };
  worker.postMessage(result, [
    result.positions.buffer,
    result.colors.buffer,
    result.uvs.buffer,
  ] as ArrayBuffer[]);
};
