import {
  LEVELS_ABOVE,
  LEVELS_BELOW,
  tileAt,
  type Chunk,
  type Tile,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";
import { rampSurface, FLOOR_HEIGHT } from "./ramps.js";
import { treeBoxes, treeGround } from "./trees.js";
import { exposedBoxFaces } from "./box-surface.js";
import { buildFungiCaps, type FungiData } from "./fungi-caps.js";
import { appendFungalStem, roundFungalStem } from "./fungi-stems.js";
import { appendFungalBranches, roundFungalBranches } from "./fungi-branches.js";
export interface MeshData {
  positions: number[];
  colors: number[];
  uvs: number[];
  fungi?: FungiData;
}
const palette: Record<number, number[]> = {
  1: [0.44, 0.32, 0.22],
  2: [0.48, 0.53, 0.57],
  3: [0.35, 0.42, 0.48],
  4: [0.25, 0.27, 0.3],
  5: [0.59, 0.48, 0.31],
  6: [0.48, 0.72, 0.8],
  7: [0.65, 0.61, 0.5],
  8: [0.37, 0.5, 0.23],
  9: [0.25, 0.39, 0.18],
  10: [0.53, 0.47, 0.26],
  23: [0.39, 0.27, 0.16],
};
export function linearMaterialColor(rgb: number[]) {
  return rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}
export const wallCapColor = linearMaterialColor([49, 44, 52]);
function solid(t: Tile | undefined) {
  return (t?.shape === "wall" && !t.treeGraphic) || t?.shape === "unknown";
}
export function buildMesh(
  c: Chunk,
  chunks: Map<string, Chunk>,
  cut: number,
  textureUV: (ref?: SpriteRef, transparent?: boolean) => TerrainUV = () => [
    0, 0, 1, 1,
  ],
  firstPerson = false,
  deferFungi = false,
): MeshData {
  const out: MeshData = { positions: [], colors: [], uvs: [] };
  let surfaces: Tile["surfaces"];
  let capTexture: SpriteRef | undefined;
  let capRim: SpriteRef[] = [];
  let rimTint: number[] | undefined;
  let foliage = false;
  let treeFace = false;
  const visibleCut = firstPerson ? cut + LEVELS_ABOVE : cut;
  if (c.z > visibleCut || c.z < cut - LEVELS_BELOW) return out;

  function quad(
    v: number[][],
    color: number[],
    wallCap = false,
    rim?: SpriteRef,
    crop?: [number, number, number, number],
  ) {
    const horizontal =
      v.every((p) => p[1] === v[0][1]) ||
      !(v.every((p) => p[0] === v[0][0]) || v.every((p) => p[2] === v[0][2]));
    const faceColor = rim
      ? (rimTint ?? color)
      : wallCap
        ? capTexture
          ? [1, 1, 1]
          : wallCapColor
        : horizontal && surfaces?.topTint
          ? linearMaterialColor(surfaces.topTint)
          : color;
    const [left, bottom, right, top] = textureUV(
      rim ??
        (wallCap ? capTexture : horizontal ? surfaces?.top : surfaces?.side),
      !!rim || foliage,
    );
    let uv = horizontal
      ? [
          [left, bottom],
          [right, bottom],
          [right, top],
          [left, top],
        ]
      : [
          [left, bottom],
          [left, top],
          [right, top],
          [right, bottom],
        ];
    if (crop) {
      const [s0, t0, s1, t1] = crop,
        original = uv;
      uv = [
        [s0, t0],
        [s1, t0],
        [s1, t1],
        [s0, t1],
      ].map(([s, t]) =>
        original[0].map(
          (v, k) => v + s * (original[1][k] - v) + t * (original[3][k] - v),
        ),
      );
    }
    for (const i of [0, 1, 2, 0, 2, 3]) {
      out.positions.push(...v[i]);
      const shade =
        treeFace && !horizontal
          ? v.every((p) => p[0] === v[0][0])
            ? 0.78
            : 0.9
          : 1;
      out.colors.push(...faceColor.map((c) => c * shade));
      out.uvs.push(...uv[i]);
    }
  }
  for (let i = 0; i < 256; i++) {
    const t = c.tiles[i];
    if (!t || t.shape === "empty") continue;
    surfaces = t.shape === "unknown" ? undefined : t.surfaces;
    // Hidden material identities stay redacted, but exposed geometry behind
    // plants still needs a generic stone skin instead of flat grey faces.
    if (t.sealed && c.ceilingTexture)
      surfaces = {
        top: c.ceilingTexture,
        side: c.ceilingTexture,
        topTint: [190, 190, 190],
      };
    capTexture = t.wallCap;
    capRim = t.wallRim ?? [];
    rimTint = t.wallRimTint ? linearMaterialColor(t.wallRimTint) : undefined;
    const x = c.x + (i % 16),
      y = c.y + Math.floor(i / 16),
      z = c.z;
    let color =
      t.shape === "unknown"
        ? [0.09, 0.105, 0.12]
        : t.color
          ? linearMaterialColor(t.color)
          : (palette[t.material] ?? [0.53, 0.52, 0.46]);
    function box(
      h: number,
      dx = 0,
      dy = 0,
      w = 1,
      d = 1,
      base = 0,
      cull = false,
    ) {
      const a = x + dx,
        b = y + dy,
        l = z + base,
        u = l + h;
      const neighbour = (nx: number, ny: number, nz: number) =>
        nz <= visibleCut && solid(tileAt(chunks, nx, ny, nz));
      if (!cull || !neighbour(x + 1, y, z))
        quad(
          [
            [a + w, l, b],
            [a + w, u, b],
            [a + w, u, b + d],
            [a + w, l, b + d],
          ],
          color,
        );
      if (!cull || !neighbour(x - 1, y, z))
        quad(
          [
            [a, l, b + d],
            [a, u, b + d],
            [a, u, b],
            [a, l, b],
          ],
          color,
        );
      if (!cull || !neighbour(x, y + 1, z))
        quad(
          [
            [a + w, l, b + d],
            [a + w, u, b + d],
            [a, u, b + d],
            [a, l, b + d],
          ],
          color,
        );
      if (!cull || !neighbour(x, y - 1, z))
        quad(
          [
            [a, l, b],
            [a, u, b],
            [a + w, u, b],
            [a + w, l, b],
          ],
          color,
        );
      if (
        (!cull || !neighbour(x, y, z + 1)) &&
        !(
          treeFace &&
          u === z + 1 &&
          /TRUNK/.test(t.treeGraphic ?? "") &&
          tileAt(chunks, x, y, z + 1)?.treeGraphic
        )
      ) {
        quad(
          [
            [a, u, b + d],
            [a + w, u, b + d],
            [a + w, u, b],
            [a, u, b],
          ],
          color,
          cull,
        );
        if (cull)
          for (const [layer, rim] of capRim.entries())
            quad(
              [
                [a, u + 0.004 + layer * 0.001, b + d],
                [a + w, u + 0.004 + layer * 0.001, b + d],
                [a + w, u + 0.004 + layer * 0.001, b],
                [a, u + 0.004 + layer * 0.001, b],
              ],
              color,
              false,
              rim,
            );
      }
      if (!cull || !neighbour(x, y, z - 1)) {
        const original = surfaces;
        const below =
          firstPerson && (t.sealed || t.shape === "unknown")
            ? tileAt(chunks, x, y, z - 1)?.surfaces
            : undefined;
        if (
          firstPerson &&
          (t.sealed || t.shape === "unknown") &&
          (below || c.ceilingTexture)
        )
          surfaces = {
            top: below?.side ?? c.ceilingTexture!,
            side: below?.side ?? c.ceilingTexture!,
            topTint: [190, 190, 190],
          };
        quad(
          [
            [a, l, b],
            [a + w, l, b],
            [a + w, l, b + d],
            [a, l, b + d],
          ],
          color,
        );
        surfaces = original;
      }
    }
    if (t.treeGraphic) {
      if (/CAP/.test(t.treeGraphic)) continue;
      const ground = treeGround(t, x, y, z, chunks);
      if (ground) {
        surfaces = ground.surfaces;
        color = ground.color
          ? linearMaterialColor(ground.color)
          : (palette[ground.material] ?? [0.53, 0.52, 0.46]);
        box(FLOOR_HEIGHT);
      }
      treeFace = true;
      const roundStem = roundFungalStem(t);
      if (roundStem) appendFungalStem(out, t, x, y, z, chunks, textureUV);
      const roundBranches = roundFungalBranches(t);
      if (roundBranches)
        appendFungalBranches(out, t, x, y, z, chunks, textureUV);
      color = [1, 1, 1];
      capTexture = undefined;
      capRim = [];
      const parts = treeBoxes(t, x, y, z, chunks);
      const faces = exposedBoxFaces(parts);
      for (const [index, part] of parts.entries()) {
        if (roundBranches && part.part === "bark") continue;
        if (
          roundStem &&
          part.part === "bark" &&
          part.h === 1 &&
          part.w > 0.5 &&
          part.d > 0.5
        )
          continue;
        foliage = true;
        let ref =
          part.part === "leaves"
            ? t.tree?.leaves
            : part.part === "cap"
              ? t.tree?.cap
              : t.tree?.bark;
        color = ref
          ? [1, 1, 1]
          : part.part === "leaves"
            ? [0.32, 0.5, 0.13]
            : (palette[t.material] ?? palette[23]);
        if (ref && part.part === "leaves") {
          const w = Math.max(1, Math.round(ref.width * part.w)),
            h = Math.max(1, Math.round(ref.height * part.d));
          ref = {
            ...ref,
            x: ref.x + Math.floor((ref.width - w) / 2),
            y: ref.y + Math.floor((ref.height - h) / 2),
            width: w,
            height: h,
          };
        }
        const barkSide = t.tree?.side ?? ref;
        const side =
          barkSide && part.part === "bark"
            ? {
                ...barkSide,
                x: barkSide.x + Math.floor(barkSide.width * 0.3),
                y: barkSide.y + Math.floor(barkSide.height * 0.3),
                width: Math.max(1, Math.floor(barkSide.width * 0.4)),
                height: Math.max(1, Math.floor(barkSide.height * 0.4)),
              }
            : ref;
        surfaces = ref
          ? {
              top: part.part === "bark" && part.h < 0.9 ? side! : ref,
              side: side!,
            }
          : undefined;
        for (const face of faces.filter((f) => f.box === index)) {
          if (
            face.vertices.every((v) => Math.abs(v[1] - 1) < 1e-9) &&
            /TRUNK/.test(t.treeGraphic) &&
            tileAt(chunks, x, y, z + 1)?.treeGraphic
          )
            continue;
          quad(
            face.vertices.map((v) => [x + v[0], z + v[1], y + v[2]]),
            color,
            false,
            undefined,
            face.crop,
          );
        }
      }
      foliage = false;
      treeFace = false;
    } else if (t.shape === "wall" || t.shape === "unknown")
      box(1, 0, 0, 1, 1, 0, true);
    else if (t.shape === "stairs") {
      if (!firstPerson) box(0.12);
      const stairArt = c.objects?.some(
        (o) => o.id === `s:${x}:${y}:${z}` && o.sprite,
      );
      for (let s = 0; (firstPerson || !stairArt) && s < 4; s++)
        box((s + 1) * 0.22, 0, s / 4, firstPerson ? 0.28 : 0.65, 0.25, 0.12);
    } else if (t.shape === "ramp") {
      const { corners, center } = rampSurface(chunks, x, y, z);
      // Clockwise in map XY, counterclockwise when viewed from above in Three.js.
      const offsets = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      const top = offsets.map(([dx, dy], i) => [
        x + dx,
        z + corners[i],
        y + dy,
      ]);
      const middle = [x + 0.5, z + center, y + 0.5];
      for (let edge = 0; edge < 4; edge++) {
        const a = top[edge],
          b = top[(edge + 1) % 4];
        quad([a, b, middle, middle], color);
        quad([[a[0], z, a[2]], [b[0], z, b[2]], b, a], color);
      }
      quad(
        [
          [x, z, y],
          [x + 1, z, y],
          [x + 1, z, y + 1],
          [x, z, y + 1],
        ],
        color,
      );
    } else box(FLOOR_HEIGHT);
  }
  if (!deferFungi) {
    const fungi = buildFungiCaps(
      c,
      chunks,
      textureUV,
      !firstPerson && c.z === cut,
    );
    if (fungi.positions.length) out.fungi = fungi;
  }
  return out;
}
