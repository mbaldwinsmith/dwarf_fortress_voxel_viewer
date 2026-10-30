import type { Chunk, Tile } from "../shared/model.js";
export const openTile = (t: Tile | undefined) =>
  !!t && t.shape !== "unknown" && (t.shape !== "wall" || !!t.treeGraphic);
/** Reveal natural wall material only beside confirmed open, revealed terrain.
 * Missing neighbours fail closed; a later block sweep can reveal the edge. */
export function maskEnclosedWalls(
  chunk: Chunk,
  neighbourOpen: (x: number, y: number, z: number) => boolean = () => false,
) {
  for (let i = 0; i < 256; i++) {
    const t = chunk.tiles[i];
    if (t.shape !== "wall" || t.treeGraphic) continue;
    const x = chunk.x + (i % 16),
      y = chunk.y + Math.floor(i / 16);
    let mask = 0;
    [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([dx, dy], bit) => {
      const nx = x + dx,
        ny = y + dy;
      const open =
        nx >= chunk.x && nx < chunk.x + 16 && ny >= chunk.y && ny < chunk.y + 16
          ? openTile(chunk.tiles[(ny - chunk.y) * 16 + nx - chunk.x])
          : neighbourOpen(nx, ny, chunk.z);
      if (open) mask |= 1 << bit;
    });
    if (mask) t.wallMask = mask;
    if (!mask && t.material !== 7)
      chunk.tiles[i] = {
        shape: "wall",
        material: 2,
        name: "Solid rock",
        sealed: true,
      };
  }
}
