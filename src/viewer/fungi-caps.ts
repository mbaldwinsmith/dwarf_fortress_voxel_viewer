import * as THREE from "three";
import {
  chunkKey,
  type Chunk,
  type Tile,
  type SpriteRef,
} from "../shared/model.js";
import type { TerrainUV } from "./terrain-atlas.js";

type Point = [number, number, number];
export interface Column {
  x: number;
  y: number;
  bottom: number;
  top: number;
  tile: Tile;
}
export interface FungiData {
  positions: number[];
  normals: number[];
  caps: number[];
  undersides: number[];
}
const cells = new WeakMap<
  Chunk,
  { x: number; y: number; z: number; tile: Tile }[]
>();
const STEP = 0.25;
function capCells(c: Chunk) {
  let result = cells.get(c);
  if (!result) {
    result = c.tiles.flatMap((tile, i) =>
      tile.shape !== "unknown" && /CAP/.test(tile.treeGraphic ?? "")
        ? [{ x: c.x + (i % 16), y: c.y + Math.floor(i / 16), z: c.z, tile }]
        : [],
    );
    cells.set(c, result);
  }
  return result;
}
export function columnsNear(c: Chunk, chunks: Map<string, Chunk>): Column[] {
  const grouped = new Map<string, ReturnType<typeof capCells>>();
  for (let dx = -16; dx <= 16; dx += 16)
    for (let dy = -16; dy <= 16; dy += 16)
      for (let z = c.z - 10; z <= c.z + 10; z++) {
        const other = chunks.get(`${c.x + dx},${c.y + dy},${z}`);
        if (!other) continue;
        for (const cell of capCells(other)) {
          if (
            cell.x < c.x - 1 ||
            cell.x > c.x + 16 ||
            cell.y < c.y - 1 ||
            cell.y > c.y + 16
          )
            continue;
          const key = `${cell.x},${cell.y},${cell.tile.tree?.species ?? ""}`;
          const list = grouped.get(key) ?? [];
          list.push(cell);
          grouped.set(key, list);
        }
      }
  const columns: Column[] = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => a.z - b.z);
    let column: Column | undefined,
      last = -Infinity;
    for (const cell of list) {
      const top =
        cell.z +
        (/FLOOR/.test(cell.tile.treeGraphic!)
          ? 0.22
          : /RAMP/.test(cell.tile.treeGraphic!)
            ? 0.8
            : 1);
      if (!column || cell.z > last + 1) {
        column = { x: cell.x, y: cell.y, bottom: cell.z, top, tile: cell.tile };
        columns.push(column);
      } else column.top = Math.max(column.top, top);
      if (cell.tile.tree?.capSurface) column.tile = cell.tile;
      last = cell.z;
    }
  }
  return columns.filter(
    (col) => col.top >= c.z - 0.5 && col.bottom <= c.z + 1.5,
  );
}
function smoothMin(a: number, b: number, k = 0.72) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function columnDistance(p: Point, col: Column) {
  const height = col.top - col.bottom,
    r = Math.min(0.45, height * 0.45);
  const q = [
    Math.abs(p[0] - col.x - 0.5) - (0.5 - r),
    Math.abs(p[1] - (col.top + col.bottom) / 2) - (height / 2 - r),
    Math.abs(p[2] - col.y - 0.5) - (0.5 - r),
  ];
  return (
    Math.hypot(...q.map((v) => Math.max(v, 0))) +
    Math.min(Math.max(...q), 0) -
    r
  );
}
export function core(ref: SpriteRef | undefined): SpriteRef | undefined {
  if (!ref) return;
  const w = Math.max(1, Math.floor(ref.width * 0.5)),
    h = Math.max(1, Math.floor(ref.height * 0.5));
  return {
    ...ref,
    x: ref.x + Math.floor((ref.width - w) / 2),
    y: ref.y + Math.floor((ref.height - h) / 2),
    width: w,
    height: h,
  };
}
export function buildFungiCaps(
  c: Chunk,
  chunks: Map<string, Chunk>,
  uv: (ref?: SpriteRef) => TerrainUV,
  cutTop = false,
): FungiData {
  return buildFungiColumns(c, columnsNear(c, chunks), uv, cutTop);
}
export function buildFungiColumns(
  c: Pick<Chunk, "x" | "y" | "z">,
  columns: Column[],
  uv: (ref?: SpriteRef) => TerrainUV,
  cutTop = false,
): FungiData {
  const out: FungiData = {
    positions: [],
    normals: [],
    caps: [],
    undersides: [],
  };
  if (!columns.length) return out;
  const grid = new Map<string, Column[]>();
  for (const col of columns) {
    const key = `${col.x},${col.y}`,
      list = grid.get(key) ?? [];
    list.push(col);
    grid.set(key, list);
  }
  const field = (p: Point) => {
    let distance = 10;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const col of grid.get(
          `${Math.floor(p[0]) + dx},${Math.floor(p[2]) + dy}`,
        ) ?? [])
          distance = smoothMin(distance, columnDistance(p, col));
    return distance;
  };
  const normalCache = new Map<string, Point>();
  const normal = (p: Point): Point => {
    const key = p.map((v) => Math.round(v * 1e7)).join(","),
      cached = normalCache.get(key);
    if (cached) return cached;
    const e = 0.001,
      d = [0, 1, 2].map((axis) => {
        const a = [...p] as Point,
          b = [...p] as Point;
        a[axis] += e;
        b[axis] -= e;
        return field(a) - field(b);
      });
    const length = Math.hypot(...d) || 1;
    const result = d.map((v) => v / length) as Point;
    normalCache.set(key, result);
    return result;
  };
  const material = (p: Point) =>
    columns.reduce((a, b) =>
      columnDistance(p, a) < columnDistance(p, b) ? a : b,
    ).tile.tree;
  function triangle(a: Point, b: Point, d: Point, flat = false) {
    const cross = new THREE.Vector3().crossVectors(
      new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a)),
      new THREE.Vector3().fromArray(d).sub(new THREE.Vector3().fromArray(a)),
    );
    if (cross.lengthSq() < 1e-16) return;
    const center = a.map((v, i) => (v + b[i] + d[i]) / 3) as Point,
      n = flat ? ([0, 1, 0] as Point) : normal(center);
    if (cross.dot(new THREE.Vector3(...n)) < 0) [b, d] = [d, b];
    const tree = material(center),
      cap = tree?.capSurface ?? core(tree?.cap),
      under = core(tree?.bark) ?? cap;
    const capUV = uv(cap),
      underUV = uv(under);
    for (const p of [a, b, d]) {
      out.positions.push(...p);
      out.normals.push(...(flat ? n : normal(p)));
      out.caps.push(...capUV);
      out.undersides.push(...underUV);
    }
  }
  const corners: Point[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ];
  const tetrahedra = [
    [0, 5, 1, 6],
    [0, 1, 2, 6],
    [0, 2, 3, 6],
    [0, 3, 7, 6],
    [0, 7, 4, 6],
    [0, 4, 5, 6],
  ];
  const minX = Math.max(
      c.x,
      Math.floor(Math.min(...columns.map((v) => v.x)) - 0.5),
    ),
    maxX = Math.min(
      c.x + 16,
      Math.ceil(Math.max(...columns.map((v) => v.x)) + 1.5),
    );
  const minY = Math.max(
      c.y,
      Math.floor(Math.min(...columns.map((v) => v.y)) - 0.5),
    ),
    maxY = Math.min(
      c.y + 16,
      Math.ceil(Math.max(...columns.map((v) => v.y)) + 1.5),
    );
  const samples = new Map<string, number>();
  const value = (p: Point) => {
    const key = p.join(",");
    let v = samples.get(key);
    if (v === undefined) {
      v = field(p);
      // Exact grid-plane contacts belong to the exterior. Floating-point
      // noise must not move a thin cap's underside into an absent lower chunk.
      if (Math.abs(v) < 1e-9) v = 0;
      samples.set(key, v);
    }
    return v;
  };
  // One near-boundary sample retains .22-tile floors; the remaining quarter
  // steps avoid spending eight vertical slices on every thick cap voxel.
  const heights = [0, 0.0625, 0.3125, 0.5625, 0.8125, 1].map((h) => c.z + h);
  for (let x = minX; x < maxX; x += STEP)
    for (let y = minY; y < maxY; y += STEP)
      for (let layer = 0; layer < heights.length - 1; layer++) {
        const z = heights[layer],
          verticalStep = heights[layer + 1] - z;
        const p = corners.map(
            (v) =>
              [
                x + v[0] * STEP,
                z + v[1] * verticalStep,
                y + v[2] * STEP,
              ] as Point,
          ),
          v = p.map(value);
        if (v.every((n) => n >= 0) || v.every((n) => n < 0)) continue;
        for (const indices of tetrahedra) {
          const inside = indices.filter((i) => v[i] < 0),
            outside = indices.filter((i) => v[i] >= 0);
          if (!inside.length || !outside.length) continue;
          const points: Point[] = [];
          for (const a of inside)
            for (const b of outside) {
              const t = v[a] / (v[a] - v[b]);
              points.push(p[a].map((n, i) => n + (p[b][i] - n) * t) as Point);
            }
          const center = points[0].map(
            (_, i) => points.reduce((sum, p) => sum + p[i], 0) / points.length,
          ) as Point;
          const n = new THREE.Vector3(...normal(center)),
            axis = new THREE.Vector3(...points[0])
              .sub(new THREE.Vector3(...center))
              .normalize(),
            other = new THREE.Vector3().crossVectors(n, axis);
          points.sort((a, b) => {
            const angle = (p: Point) => {
              const d = new THREE.Vector3(...p).sub(
                new THREE.Vector3(...center),
              );
              return Math.atan2(d.dot(other), d.dot(axis));
            };
            return angle(a) - angle(b);
          });
          for (let i = 1; i + 1 < points.length; i++)
            triangle(points[0], points[i], points[i + 1]);
        }
      }
  if (cutTop)
    for (let x = minX; x < maxX; x += STEP)
      for (let y = minY; y < maxY; y += STEP) {
        const p: Point[] = [
          [x, c.z + 1, y],
          [x + STEP, c.z + 1, y],
          [x + STEP, c.z + 1, y + STEP],
          [x, c.z + 1, y + STEP],
        ];
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const polygon: Point[] = [];
          for (let i = 0; i < 3; i++) {
            const a = p[ids[i]],
              b = p[ids[(i + 1) % 3]],
              va = value(a),
              vb = value(b);
            if (va < 0) polygon.push(a);
            if (va < 0 !== vb < 0) {
              const t = va / (va - vb);
              polygon.push(a.map((n, k) => n + (b[k] - n) * t) as Point);
            }
          }
          for (let i = 1; i + 1 < polygon.length; i++)
            triangle(polygon[0], polygon[i], polygon[i + 1], true);
        }
      }
  return out;
}

// Mirrored, world-anchored triplanar sampling has no atlas-wrap seams and no
// stretched sprite edges. Blended projections remain continuous around curves.
export function fungiMaterial(atlas: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { atlas: { value: atlas } },
    vertexShader: `
    attribute vec4 capRect;attribute vec4 undersideRect;
    varying vec3 positionWorld;varying vec3 surfaceNormal;varying vec4 capUV;varying vec4 undersideUV;
    void main(){positionWorld=position;surfaceNormal=normal;capUV=capRect;undersideUV=undersideRect;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,
    fragmentShader: `
    uniform sampler2D atlas;varying vec3 positionWorld;varying vec3 surfaceNormal;varying vec4 capUV;varying vec4 undersideUV;
    vec3 samplePlane(vec2 p,vec4 rect){vec2 uv=1.-abs(fract(p*.5)*2.-1.);return texture2D(atlas,mix(rect.xy,rect.zw,uv)).rgb;}
    vec3 triplanar(vec4 rect,vec3 weights,float scale){vec3 p=positionWorld*scale;return samplePlane(p.zy,rect)*weights.x+samplePlane(p.xz,rect)*weights.y+samplePlane(p.xy,rect)*weights.z;}
    void main(){vec3 n=normalize(surfaceNormal);vec3 w=pow(abs(n),vec3(3.));w/=max(dot(w,vec3(1.)),.0001);
      vec3 skin=triplanar(capUV,w,1.);
      float underside=smoothstep(.45,.94,-n.y);
      vec3 color=skin;
      if(underside>0.){vec3 gills=triplanar(undersideUV,w,2.5);color=mix(skin,mix(skin,gills*.82,.72),underside);}
      float light=.76+.24*max(dot(n,normalize(vec3(-.4,.85,.3))),0.);
      gl_FragColor=vec4(color*light,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
}
