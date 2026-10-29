/** Native wall directions describe exposed edges. Diagonal-only neighbours
 * require corner art when neither bordering cardinal edge is already exposed. */
export function wallTileSuffixes(mask: number) {
  const result: string[] = [];
  const cardinal = ["N", "S", "W", "E"].filter((_d, i) => mask & (1 << i));
  if (cardinal.length) result.push(cardinal.join("_"));
  for (const [bit, name, borders] of [
    [4, "NW", 1 | 4],
    [5, "NE", 1 | 8],
    [6, "SW", 2 | 4],
    [7, "SE", 2 | 8],
  ] as const)
    if (mask & (1 << bit) && !(mask & borders)) result.push(name);
  return result;
}
