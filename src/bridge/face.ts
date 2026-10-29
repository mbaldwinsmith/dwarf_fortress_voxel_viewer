/** The game random-part index is absent from RFR. Keep an artistic substitute
 * stable per unit, independently of polling order, hair and equipment changes. */
export function faceVariant(id: number): number {
  let hash = id >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (((hash ^ (hash >>> 16)) >>> 0) % 4) + 1;
}
export function eyeColor(
  caste: Record<string, unknown>,
  appearance: Record<string, unknown>,
): [number, number, number] | undefined {
  const parts = caste.bodyParts as Record<string, unknown>[] | undefined,
    modifiers = caste.colorModifiers as Record<string, unknown>[] | undefined,
    values = appearance.colors as number[] | undefined;
  if (!parts || !modifiers || !values) return;
  for (let i = 0; i < modifiers.length; i++) {
    const m = modifiers[i],
      ids = m.bodyPartId;
    if (!Array.isArray(ids) || !ids.some((id) => parts[id]?.category === "EYE"))
      continue;
    const patterns = m.patterns as Record<string, unknown>[] | undefined,
      p = patterns?.[values[i]];
    // Native IRIS_EYE palettes are sclera, pupil, iris, in that order.
    if (typeof p?.id !== "string" || !p.id.startsWith("IRIS_EYE_")) continue;
    const colors = p.colors as Record<string, unknown>[] | undefined,
      iris = colors?.[2];
    if (!iris) continue;
    const rgb = [iris.red, iris.green, iris.blue];
    if (
      rgb.every(
        (n) =>
          typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255,
      )
    )
      return rgb as [number, number, number];
  }
}
