/** Compress raw body volumes around an adult dwarf (60,000). Native artwork
 * retains its aspect ratio and proportions; equipment uses the same factor.
 * log1p handles tiny creatures without a negative or zero display size. */
export function creatureScale(bodySize?: number): number {
  if (bodySize === undefined || !Number.isFinite(bodySize) || bodySize <= 0)
    return 1;
  return Math.max(
    0.35,
    Math.min(3, Math.log1p(bodySize / 6000) / Math.log1p(10)),
  );
}
