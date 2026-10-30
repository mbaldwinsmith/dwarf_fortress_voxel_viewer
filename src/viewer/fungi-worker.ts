import { indexAttributes, type MeshIndex } from "./indexed-geometry.js";
import { buildFungiColumns, type Column } from "./fungi-caps.js";
import type { TerrainUV } from "./terrain-atlas.js";
import type { Chunk } from "../shared/model.js";
export interface CapJob {
  id: number;
  key: string;
  c: Pick<Chunk, "x" | "y" | "z">;
  columns: Column[];
  rects: [string, TerrainUV][];
  cutTop: boolean;
}
export interface CapResult {
  id: number;
  key: string;
  positions: Float32Array;
  normals: Float32Array;
  caps: Float32Array;
  undersides: Float32Array;
  indices?: MeshIndex;
}
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<CapJob>) => void) | null;
  postMessage: (message: CapResult, transfer: Transferable[]) => void;
};
worker.onmessage = ({ data: job }) => {
  const rects = new Map(job.rects),
    data = buildFungiColumns(
      job.c,
      job.columns,
      (ref) => rects.get(JSON.stringify(ref)) ?? [0, 0, 1, 1],
      job.cutTop,
    );
  const packed = indexAttributes({
    positions: { array: new Float32Array(data.positions), size: 3 },
    normals: { array: new Float32Array(data.normals), size: 3 },
    caps: { array: new Float32Array(data.caps), size: 4 },
    undersides: { array: new Float32Array(data.undersides), size: 4 },
  });
  const result: CapResult = {
    id: job.id,
    key: job.key,
    positions: packed.attributes.positions.array,
    normals: packed.attributes.normals.array,
    caps: packed.attributes.caps.array,
    undersides: packed.attributes.undersides.array,
    indices: packed.index,
  };
  worker.postMessage(result, [
    result.positions.buffer,
    result.normals.buffer,
    result.caps.buffer,
    result.undersides.buffer,
    ...(result.indices ? [result.indices.buffer] : []),
  ] as ArrayBuffer[]);
};
