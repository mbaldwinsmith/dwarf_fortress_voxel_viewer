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
  const result: CapResult = {
    id: job.id,
    key: job.key,
    positions: new Float32Array(data.positions),
    normals: new Float32Array(data.normals),
    caps: new Float32Array(data.caps),
    undersides: new Float32Array(data.undersides),
  };
  worker.postMessage(result, [
    result.positions.buffer,
    result.normals.buffer,
    result.caps.buffer,
    result.undersides.buffer,
  ] as ArrayBuffer[]);
};
