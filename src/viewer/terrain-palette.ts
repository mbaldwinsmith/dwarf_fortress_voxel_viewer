/** Native environment sheets contain both exact palette colours and older
 * neutral shades. Interpolate only those neutral shades through the cool half
 * of the installed 18-colour palette; preserve authored coloured details. */
export function terrainPalette(
  pixels: Uint8ClampedArray,
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
) {
  const exact = new Map<number, number[]>(),
    ramp: { light: number; rgb: number[] }[] = [];
  const light = (r: number, g: number, b: number) =>
    r * 0.2126 + g * 0.7152 + b * 0.0722;
  for (let i = 0; i < Math.min(source.length, target.length); i += 4) {
    const rgb = [...target.slice(i, i + 3)];
    exact.set((source[i] << 16) | (source[i + 1] << 8) | source[i + 2], rgb);
    if (i >= 36 && source[i + 3] && target[i + 3])
      ramp.push({ light: light(source[i], source[i + 1], source[i + 2]), rgb });
  }
  ramp.sort((a, b) => a.light - b.light);
  const legacy: { index: number; source: number; target: number }[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const match = exact.get((r << 16) | (g << 8) | b);
    if (match) {
      pixels.set(match, i);
      continue;
    }
    if (!ramp.length || Math.max(r, g, b) - Math.min(r, g, b) > 24) continue;
    const value = light(r, g, b),
      hi = ramp.findIndex((p) => p.light >= value);
    if (hi <= 0) pixels.set(ramp[hi < 0 ? ramp.length - 1 : 0].rgb, i);
    else {
      const a = ramp[hi - 1],
        z = ramp[hi],
        t = (value - a.light) / (z.light - a.light);
      pixels.set(
        a.rgb.map((c, k) => Math.round(c + (z.rgb[k] - c) * t)),
        i,
      );
    }
    legacy.push({
      index: i,
      source: value,
      target: light(pixels[i], pixels[i + 1], pixels[i + 2]),
    });
  }
  // Dark palette rows can repeat shades across the small range of the legacy
  // smooth-floor texture. Retain its original relief contrast rather than
  // collapsing that native pattern to a flat fill. Exact palette pixels stay exact.
  if (legacy.length) {
    const values = legacy.map((v) => v.source),
      mapped = legacy.map((v) => v.target);
    const range = Math.max(...values) - Math.min(...values),
      output = Math.max(...mapped) - Math.min(...mapped);
    if (range > 0 && output < range) {
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      for (const p of legacy)
        for (let k = 0; k < 3; k++)
          pixels[p.index + k] += (p.source - mean) * (1 - output / range);
    }
  }
}

/** Reuse the material's own native shade range for a carved motif. This keeps
 * glass, ice and wood carvings part of their support instead of grey plaques. */
export function terrainTone(
  pixels: Uint8ClampedArray,
  material: Uint8ClampedArray,
) {
  const light = (p: number[]) => p[0] * 0.2126 + p[1] * 0.7152 + p[2] * 0.0722;
  const shades: number[][] = [],
    seen = new Set<number>();
  for (let i = 0; i < material.length; i += 4)
    if (material[i + 3]) {
      const key =
        (material[i] << 16) | (material[i + 1] << 8) | material[i + 2];
      if (!seen.has(key)) {
        seen.add(key);
        shades.push([...material.slice(i, i + 3)]);
      }
    }
  if (!shades.length) return;
  shades.sort((a, b) => light(a) - light(b));
  // Count distinct authored shades, not their occupied area: glass has a large
  // flat pane plus thin highlights, which otherwise collapses to one colour.
  const ramp = [0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7, 1].map(
    (q) => shades[Math.round((shades.length - 1) * q)],
  );
  let low = 255,
    high = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i + 3]) {
      const v = light([...pixels.slice(i, i + 3)]);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const v =
      Math.max(
        0,
        Math.min(
          1,
          (light([...pixels.slice(i, i + 3)]) - low) / Math.max(1, high - low),
        ),
      ) * 7;
    const lo = Math.floor(v),
      hi = Math.min(7, lo + 1),
      f = v - lo;
    pixels.set(
      ramp[lo].map((n, k) => Math.round(n + (ramp[hi][k] - n) * f)),
      i,
    );
  }
}
