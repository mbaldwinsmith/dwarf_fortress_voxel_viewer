import { it, expect } from "vitest";
import * as THREE from "three";
import { canWalk, walkingHeight } from "../src/viewer/first-person.js";
import { buildMesh } from "../src/viewer/mesh.js";
import { chunkKey, type Chunk } from "../src/shared/model.js";
const chunk = (
  x = 0,
  z = 4,
  shape: "floor" | "wall" | "unknown" | "empty" = "floor",
): Chunk => ({
  x,
  y: 0,
  z,
  tiles: Array.from({ length: 256 }, () => ({
    shape,
    material: 2,
    name: "Terrain",
  })),
});
const world = (...chunks: Chunk[]) =>
  new Map(chunks.map((c) => [chunkKey(c), c]));
it("requires revealed walkable ground and loaded overhead, including across chunk seams", () => {
  const a = chunk(),
    b = chunk(16),
    roof = chunk(0, 5, "unknown"),
    roof2 = chunk(16, 5, "wall");
  const all = world(a, b, roof, roof2);
  expect(canWalk(all, 15.95, 4.5, 4)).toBe(true);
  expect(canWalk(world(a, roof), 15.95, 4.5, 4)).toBe(false);
  expect(canWalk(world(a), 2.5, 4.5, 4)).toBe(false);
  expect(canWalk(world(a), 2.5, 4.5, 4, 4)).toBe(true);
  a.tiles[4 * 16 + 2].shape = "unknown";
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(false);
  expect(walkingHeight(all, 3.5, 4.5, 4)).toBe(4.12);
});
it("blocks wall clipping at the player radius and low ramp headroom", () => {
  const a = chunk(),
    roof = chunk(0, 5, "wall");
  a.tiles[4 * 16 + 3].shape = "wall";
  const all = world(a, roof);
  expect(canWalk(all, 2.9, 4.5, 4)).toBe(false);
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(true);
  a.tiles[4 * 16 + 2].shape = "ramp";
  expect(canWalk(all, 2.5, 4.5, 4)).toBe(false);
});
it("renders upper walls and ceiling undersides in first person while keeping orbit cutaways", () => {
  const floor = chunk(),
    roof = chunk(0, 5, "empty");
  roof.tiles[2].shape = "unknown";
  roof.tiles[3].shape = "wall";
  const all = world(floor, roof);
  expect(buildMesh(roof, all, 4).positions).toHaveLength(0);
  const data = buildMesh(roof, all, 4, undefined, true);
  expect(data.positions.some((v, i) => i % 3 === 1 && v > 5)).toBe(true);
  let underside = false;
  for (let i = 0; i < data.positions.length; i += 9) {
    const [a, b, c] = [i, i + 3, i + 6].map((j) =>
      data.positions.slice(j, j + 3),
    );
    if ([a, b, c].every((v) => v[1] === 5)) {
      const normalY =
        (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (normalY < 0) underside = true;
    }
  }
  expect(underside).toBe(true);
  expect(buildMesh(roof, all, 2, undefined, true).positions).toHaveLength(0);
});
it("keeps an open vertical sight line through upper stair shafts", () => {
  const above = chunk(0, 5, "empty");
  above.tiles[2] = { shape: "stairs", material: 2, name: "Up/down stair" };
  const all = world(chunk(), above),
    data = buildMesh(above, all, 4, undefined, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.positions, 3),
  );
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(2.5, 4.7, 0.5),
    new THREE.Vector3(0, 1, 0),
  );
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  expect(data.positions.length).toBeGreaterThan(0);
  geometry.dispose();
  mesh.material.dispose();
});
