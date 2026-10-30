export interface VertexAttribute {
  array: Float32Array;
  size: number;
}
export type MeshIndex = Uint16Array | Uint32Array;

/** Lossless vertex indexing. Every attribute's float bits participate, so UV
 * seams, flat normals, native texels and colour boundaries stay unchanged. */
export function indexAttributes<T extends Record<string, VertexAttribute>>(
  attributes: T,
): { attributes: T; index?: MeshIndex } {
  const list = Object.values(attributes),
    count = list[0].array.length / list[0].size;
  if (!count) return { attributes };
  if (
    !Number.isInteger(count) ||
    list.some((a) => a.array.length !== count * a.size)
  )
    throw Error("Mismatched vertex attributes");
  const words = list.map(
    (a) => new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length),
  );
  let capacity = 1;
  while (capacity < count * 1.5) capacity *= 2;
  const table = new Uint32Array(capacity),
    mask = capacity - 1;
  const first = new Uint32Array(count),
    indices = new Uint32Array(count);
  let unique = 0;
  for (let v = 0; v < count; v++) {
    let hash = 2166136261;
    for (let a = 0; a < list.length; a++)
      for (let j = 0; j < list[a].size; j++) {
        const word = words[a][v * list[a].size + j];
        hash = Math.imul(hash ^ word ^ (word >>> 16), 16777619);
      }
    hash ^= hash >>> 16;
    let slot = hash & mask;
    while (table[slot]) {
      const candidate = first[table[slot] - 1];
      let equal = true;
      for (let a = 0; equal && a < list.length; a++)
        for (let j = 0; j < list[a].size; j++)
          if (
            words[a][candidate * list[a].size + j] !==
            words[a][v * list[a].size + j]
          ) {
            equal = false;
            break;
          }
      if (equal) break;
      slot = (slot + 1) & mask;
    }
    if (!table[slot]) {
      first[unique] = v;
      table[slot] = ++unique;
    }
    indices[v] = table[slot] - 1;
  }
  const strideBytes = list.reduce((n, a) => n + a.size * 4, 0),
    indexBytes = unique <= 65536 ? 2 : 4;
  if (unique * strideBytes + count * indexBytes >= count * strideBytes)
    return { attributes };
  const result = {} as T;
  for (const [name, a] of Object.entries(attributes)) {
    const array = new Float32Array(unique * a.size);
    const source = new Uint32Array(
      a.array.buffer,
      a.array.byteOffset,
      a.array.length,
    );
    const target = new Uint32Array(array.buffer);
    for (let v = 0; v < unique; v++)
      for (let j = 0; j < a.size; j++)
        target[v * a.size + j] = source[first[v] * a.size + j];
    result[name as keyof T] = { array, size: a.size } as T[keyof T];
  }
  return {
    attributes: result,
    index: indexBytes === 2 ? new Uint16Array(indices) : indices,
  };
}
