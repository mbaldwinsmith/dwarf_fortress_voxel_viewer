import { tileAt, type Tile, type Chunk } from "../shared/model.js";
export interface TreeBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  part: "bark" | "leaves" | "cap";
}
export function treeGround(
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
) {
  if (!/TRUNK/.test(t.treeGraphic ?? "") || t.shape === "unknown") return;
  const below = tileAt(chunks, x, y, z - 1);
  if (
    below?.treeGraphic ||
    !(
      t.tree?.progress === 0 ||
      below?.shape === "wall" ||
      below?.shape === "unknown"
    )
  )
    return;
  const neighbours = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ].map(([dx, dy]) => tileAt(chunks, x + dx, y + dy, z));
  return (
    neighbours.find(
      (n) => n?.shape === "floor" && !n.treeGraphic && n.surfaces,
    ) ?? neighbours.find((n) => n?.shape === "floor" && !n.treeGraphic)
  );
}
// The tile grid is DF's actual occupied tree body, not a generated tree per seed.
export function treeBoxes(
  t: Tile,
  x: number,
  y: number,
  z: number,
  chunks: Map<string, Chunk>,
): TreeBox[] {
  if (!t.treeGraphic || t.shape === "unknown") return [];
  const token = t.treeGraphic,
    out: TreeBox[] = [];
  const add = (
    a: number,
    b: number,
    c: number,
    w: number,
    h: number,
    d: number,
    part: TreeBox["part"] = "bark",
  ) => out.push({ x: a, y: b, z: c, w, h, d, part });
  if (/CAP/.test(token)) {
    if (/FLOOR/.test(token)) add(0, 0, 0, 1, 0.22, 1, "cap");
    else add(0.02, 0, 0.02, 0.96, /RAMP/.test(token) ? 0.65 : 1, 0.96, "cap");
    return out;
  }
  const trunk = /TRUNK/.test(token);
  if (trunk) {
    const connected = (dx: number, dy: number) => {
      const n = tileAt(chunks, x + dx, y + dy, z);
      return (
        /TRUNK/.test(n?.treeGraphic ?? "") &&
        n?.tree?.species === t.tree?.species
      );
    };
    const left = connected(-1, 0) ? 0 : 0.17,
      right = connected(1, 0) ? 1 : 0.83;
    const north = connected(0, -1) ? 0 : 0.17,
      south = connected(0, 1) ? 1 : 0.83;
    add(left, 0, north, right - left, 1, south - north);
  }
  if (/BRANCH|TWIG|SLOPING/.test(token)) {
    const letters = /_([NSEW]+)$/.exec(token)?.[1] ?? "NSEW";
    const thick = trunk ? 0.24 : /TWIG/.test(token) ? 0.075 : 0.15;
    const low = 0.5 - thick / 2;
    // Horizontal branches connect exactly at neighbouring tile edges.
    if (letters.includes("N")) add(low, 0.2, 0, thick, thick, 0.5);
    if (letters.includes("S")) add(low, 0.2, 0.5, thick, thick, 0.5);
    if (letters.includes("W")) add(0, 0.2, low, 0.5, thick, thick);
    if (letters.includes("E")) add(0.5, 0.2, low, 0.5, thick, thick);
    const above = tileAt(chunks, x, y, z + 1),
      below = tileAt(chunks, x, y, z - 1);
    if (above?.treeGraphic && above.tree?.species === t.tree?.species)
      add(0.44, 0.2, 0.44, 0.12, 0.8, 0.12);
    if (below?.treeGraphic && below.tree?.species === t.tree?.species)
      add(0.44, 0, 0.44, 0.12, 0.3, 0.12);
    if (/TWIG/.test(token) && !/DEAD|LEAFLESS/.test(token) && t.tree?.leaves) {
      const hash =
        (Math.imul(x, 73856093) ^
          Math.imul(y, 19349663) ^
          Math.imul(z, 83492791)) >>>
        0;
      // DF's bare branch cells stay bare. Only actual leaf/twig cells get lobes,
      // with irregular gaps rather than a solid rectangular canopy per tile.
      for (const [i, [cx, cy]] of [
        [0.25, 0.25],
        [0.73, 0.25],
        [0.25, 0.73],
        [0.73, 0.73],
        [0.5, 0.5],
      ].entries()) {
        if (i < 4 && ((hash >>> (i + 2)) & 7) === 0) continue;
        const size = 0.34 + ((hash >>> (i * 3)) & 7) * 0.018;
        const base = 0.3 + ((hash >>> (i * 2)) & 3) * 0.09;
        add(cx - size / 2, base, cy - size / 2, size, 0.26, size, "leaves");
        add(
          cx - size * 0.36,
          base + 0.26,
          cy - size * 0.36,
          size * 0.72,
          0.14,
          size * 0.72,
          "leaves",
        );
      }
    }
  }
  return out;
}
