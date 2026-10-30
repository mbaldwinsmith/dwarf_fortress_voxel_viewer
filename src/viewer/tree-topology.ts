import { tileAt, type Chunk, type Tile } from "../shared/model.js";
import { noise, treeId, type Point } from "./tree-geometry.js";

const offsets: Point[] = [
  [0, 0, -1],
  [-1, 0, 0],
  [0, -1, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const key = (p: Point) => p.join(",");
export function emptyTreeTwig(t: Tile) {
  const id = treeId(t),
    token = t.treeGraphic ?? "";
  return (
    /TWIG/.test(token) &&
    (id === "GLUMPRONG" ||
      (id === "BLOOD_THORN" && !/DEAD|LEAFLESS/.test(token)))
  );
}
/** Choose a branch hierarchy inside DF's occupied cells, rather than joining
 * every touching twig into a cubic lattice. Native directional arms remain
 * authoritative; this only resolves the unspecified twig connections. */
export class TreeTopology {
  private parents = new Map<string, string | undefined>();
  constructor(private chunks: Map<string, Chunk>) {}
  linked(a: Point, b: Point) {
    this.populate(a);
    return (
      this.parents.get(key(a)) === key(b) || this.parents.get(key(b)) === key(a)
    );
  }
  private populate(start: Point) {
    if (this.parents.has(key(start))) return;
    const original = tileAt(this.chunks, ...start),
      points: Point[] = [start],
      seen = new Set([key(start)]),
      roots: Point[] = [];
    for (let i = 0; i < points.length && points.length < 2048; i++) {
      const p = points[i],
        tile = tileAt(this.chunks, ...p);
      if (
        /TRUNK/.test(tile?.treeGraphic ?? "") &&
        !/SLOPING/.test(tile?.treeGraphic ?? "")
      )
        roots.push(p);
      for (const d of offsets) {
        const n = p.map((v, j) => v + d[j]) as Point,
          k = key(n),
          t = tileAt(this.chunks, ...n);
        if (
          !seen.has(k) &&
          t &&
          t.shape !== "unknown" &&
          t.treeGraphic &&
          !/CAP/.test(t.treeGraphic) &&
          !emptyTreeTwig(t) &&
          t.tree?.species === original?.tree?.species
        ) {
          seen.add(k);
          points.push(n);
        }
      }
    }
    if (!roots.length)
      roots.push(
        [...points].sort(
          (a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1],
        )[0],
      );
    const distance = new Map(roots.map((p) => [key(p), 0])),
      queue = [...roots];
    for (let i = 0; i < queue.length; i++)
      for (const d of offsets) {
        const p = queue[i],
          n = p.map((v, j) => v + d[j]) as Point,
          k = key(n);
        if (seen.has(k) && !distance.has(k)) {
          distance.set(k, distance.get(key(p))! + 1);
          queue.push(n);
        }
      }
    for (const p of points) {
      const candidates = offsets
        .map((d) => p.map((v, j) => v + d[j]) as Point)
        .filter((n) => distance.get(key(n)) === distance.get(key(p))! - 1);
      candidates.sort((a, b) => noise(...a) - noise(...b));
      this.parents.set(key(p), candidates[0] && key(candidates[0]));
    }
  }
}
