import type { SceneryObject } from "../shared/model.js";
import type { NativeWorkshopPixels } from "./native-workshop-relief.js";
import {
  NativeWorkshopGeometry,
  type Rect,
} from "./native-workshop-geometry.js";
import { nativeRegions, type NativeRegion } from "./native-workshop-regions.js";

export interface NativeCounter {
  x: number;
  z: number;
  X: number;
  Z: number;
  height: number;
}
export function nativeWorkshopProps(
  o: SceneryObject,
  data: NativeWorkshopPixels,
  counters: NativeCounter[],
) {
  const type = o.workshop!.type,
    W = data.width,
    H = data.height;
  const g = new NativeWorkshopGeometry(o, data),
    mask = new Uint8Array(W * H);
  const source = data.decor;
  if (!source) return { faces: g.faces, mask, authored: false };
  const hasArt = ([x, y, X, Y]: Rect) => {
    for (let b = y; b < Y; b++)
      for (let a = x; a < X; a++)
        if (source[(b * W + a) * 4 + 3] > 100) return true;
    return false;
  };
  const consume = ([x, y, X, Y]: Rect) => {
    for (let b = Math.max(0, y); b < Math.min(H, Y); b++)
      for (let a = Math.max(0, x); a < Math.min(W, X); a++) mask[b * W + a] = 1;
  };
  const tableAt = (x: number, z: number) =>
    counters.find((c) => x >= c.x && x <= c.X && z >= c.z - 0.08 && z <= c.Z);
  const prop = (r: NativeRegion) => {
    if (type === "WORKSHOP_SIEGE" && /^rear-(left|right)/.test(r.id)) return;
    if (r.base && r.kind !== "stool") return;
    const [x, y, X, Y] = r.rect,
      bw = X - x,
      bh = Y - y,
      cx = (x + X) / 64;
    const layer = r.base ? data.base : source;
    let opaque = 0;
    for (let b = y; b < Y; b++)
      for (let a = x; a < X; a++)
        if (layer[(b * W + a) * 4 + 3] > 100) opaque++;
    if (opaque < Math.max(3, bw * bh * 0.04)) return;
    let radius = Math.min(0.43, (bw / 64) * 0.92);
    const support =
      r.kind === "sack"
        ? undefined
        : tableAt(cx, Math.max(0.025, (Y - 36) / 32));
    const floor =
      type === "WORKSHOP_JEWELER" && /^rear-.*gem$/.test(r.id)
        ? 0.45
        : (support?.height ?? 0);
    let cz = Math.min(
      o.workshop!.depth - radius - 0.025,
      Math.max(radius + 0.025, (Y - 32) / 32 - radius * 0.65),
    );
    if (type === "WORKSHOP_ASHERY") {
      if (r.id === "rear-pail") {
        cz = 0.23;
        radius = 0.19;
      }
      if (r.id === "front-table-pail") {
        cz = 0.64;
        radius = 0.2;
      }
      if (r.id === "right-pail") cz = 0.94;
    }
    if (type === "WORKSHOP_TANNER") {
      if (r.id === "rear-spool") {
        cz = 0.79;
        radius = 0.11;
      }
      if (r.id === "rear-metal-pail") {
        cz = 0.94;
        radius = 0.25;
      }
    }
    if (type.includes("SOAP_MAKER")) {
      if (r.id === "front-rear-jug") cz = 1.93;
      if (r.id === "front-lidded-pot") cz = 2.32;
      if (r.id === "front-right-pot") {
        cz = 2.66;
        radius = 0.3;
      }
    }
    let h = Math.min(
      0.8 - floor,
      Math.max(0.16, (bh / 32) * (r.kind === "sack" ? 0.65 : 0.6)),
    );
    if (r.kind === "box")
      h = /cabinet|rear-large-crate/.test(r.id)
        ? 0.45
        : Math.min(0.32, h * 0.65);
    if (/bowl|mortar/.test(r.id)) h = Math.min(0.22, h);
    if (r.id === "coal-barrel") h = 0.53;
    if (type === "WORKSHOP_CARPENTER" && r.id === "rear-right-cabinet")
      h = 0.72;
    if (type === "WORKSHOP_ASHERY" && r.id === "right-tub") h = 0.53;
    if (type === "WORKSHOP_LEATHER" && r.id === "rear-large-crate") h = 0.72;
    if (type === "WORKSHOP_MASON" && r.id === "right-square-block") h = 0.4;
    if (type === "WORKSHOP_KENNEL" && r.kind === "sack") {
      h = 0.37;
      radius *= 0.78;
    }
    const body = g.patch(
      type.includes("SOAP_MAKER") && r.id === "front-lidded-pot"
        ? [29, 107, 36, 119]
        : type === "WORKSHOP_ASHERY" && r.id === "right-tub"
          ? [67, 37, 75, 48]
          : r.id === "right-blue-stock"
            ? [73, 84, 91, 94]
            : [x + bw * 0.25, y + bh * 0.36, X - bw * 0.25, Y - 1],
    );
    const top = g.patch(
      r.texturePatches?.top ?? [
        x + bw * 0.2,
        y + bh * 0.08,
        X - bw * 0.2,
        y + bh * 0.3,
      ],
      r.base,
    );
    const material = g.patch(
      r.texturePatches?.body ??
        (r.kind === "box"
          ? [x + 2, Y - 9, X - 2, Y - 2]
          : [x + bw * 0.2, y + bh * 0.42, X - bw * 0.2, Y - 2]),
      r.base,
    );
    if (r.id === "front-dish-stack" && type === "WORKSHOP_KITCHEN") {
      for (let n = 0; n < 4; n++)
        g.lathe(
          [cx, 0.24 + n * 0.035, 2.53],
          radius,
          0.028,
          g.patch([9, 103, 24, 105]),
          g.patch([9, 96, 24, 101]),
          "stone",
        );
      consume(r.rect);
    } else if (type === "WORKSHOP_LEATHER" && r.id === "front-crate-hide") {
      g.lathe(
        [cx, 0.3, 2.58],
        0.19,
        0.27,
        g.patch([51, 102, 61, 110]),
        top,
        "rock",
      );
      consume(r.rect);
    } else if (r.id.includes("hide") && r.kind === "sack") {
      for (let n = 0; n < 3; n++) {
        const yy = (r.id === "front-crate-hide" ? 0.31 : 0.055) + n * 0.055;
        g.decal(r.rect, [x / 32, cz - 0.2, X / 32, cz + 0.2], yy);
        g.box(
          [x / 32 + 0.03, yy - 0.025, cz - 0.15],
          [X / 32 - 0.03, yy, cz + 0.17],
          material,
        );
      }
      consume(r.rect);
    } else if (type === "WORKSHOP_LEATHER" && r.id === "front-low-crate") {
      g.table([1.25, 2.3, 2.06, 2.88], 0.29, top, material);
      consume(r.rect);
    } else if (r.kind === "stool") {
      if (!r.base) {
        const seat = g.skin(
          r.texturePatches?.top ?? [
            x + 2,
            y + 2,
            X - 2,
            y + Math.max(4, bh * 0.48),
          ],
        );
        g.table(
          [x / 32, Math.max(0.03, cz - 0.19), X / 32, cz + 0.19],
          0.25,
          seat,
          material,
        );
        consume(r.rect);
      }
    } else if (r.kind === "vessel" || r.kind === "sack" || r.kind === "stone") {
      const lidded =
        /lidded/.test(r.id) ||
        (type.includes("SOAP_MAKER") && r.id === "front-right-pot");
      const kind = /large-open-pot|front-large-pot/.test(r.id)
        ? "vat"
        : /TANNER|SOAP_MAKER|DYER|ASHERY/.test(type) && /pail/.test(r.id)
          ? "pail"
          : r.id === "rear-stone-cylinder"
            ? "stone"
            : r.kind === "stone"
              ? /gem|crystal/.test(r.id)
                ? "crystal"
                : "rock"
              : r.kind === "sack"
                ? "sack"
                : r.id.includes("spool")
                  ? "spool"
                  : /jug|jar|bottle/.test(r.id)
                    ? "jug"
                    : /bowl|mortar/.test(r.id)
                      ? "bowl"
                      : lidded || /closed|block|dish-stack/.test(r.id)
                        ? "barrel"
                        : "open";
      const start = g.faces.length;
      g.lathe([cx, floor, cz], radius, h, body, top, kind);
      if (type === "WORKSHOP_MASON" && /boulder|grey-rock/.test(r.id)) {
        for (const f of g.faces.slice(start))
          for (let i = 0; i < f.positions.length; i += 3) {
            const xx = f.positions[i] - cx,
              zz = f.positions[i + 2] - cz,
              yy = (f.positions[i + 1] - floor) / h;
            const variation =
              1 + 0.17 * Math.sin(Math.atan2(zz, xx) * 3 + cx * 7);
            f.positions[i] = cx + xx * variation + yy * 0.06;
            f.positions[i + 2] = cz + zz * variation * 0.82;
            f.positions[i + 1] =
              floor +
              (f.positions[i + 1] - floor) *
                (r.id.includes("brown")
                  ? 1.25
                  : r.id.includes("small")
                    ? 0.65
                    : 1.07);
          }
      }
      if (lidded) {
        g.lathe(
          [cx, floor + h - 0.015, cz],
          radius * 0.94,
          0.025,
          body,
          top,
          "stone",
        );
        g.lathe(
          [cx, floor + h + 0.01, cz],
          radius * 0.16,
          0.035,
          body,
          top,
          "stone",
        );
      }
      if (r.id === "large-open-pot" && type === "WORKSHOP_TANNER")
        g.beam(
          [cx, floor + h * 0.68, cz],
          [cx + 0.24, floor + h + 0.15, cz - 0.17],
          0.025,
          g.patch([19, 36, 29, 51], false, "wood"),
        );
      if (r.id === "front-large-pot" && type.includes("SOAP_MAKER"))
        g.beam(
          [cx, 0.4, cz],
          [cx + 0.26, 0.7, cz - 0.18],
          0.025,
          g.patch([22, 93, 29, 103], false, "wood"),
        );
      if (r.id === "right-blue-stock")
        g.cutout(
          [x, y, X, y + 13],
          [cx, floor + h - 0.1, cz],
          bw / 32,
          0.25,
          0.025,
        );
      consume(r.rect);
    } else if (r.kind === "box") {
      const z = Math.max(0.025, cz - radius * 0.7),
        Z = Math.min(o.workshop!.depth - 0.025, cz + radius * 0.7);
      const a = x / 32,
        b = X / 32,
        t = 0.035;
      if (
        /open|bin|crate/.test(r.id) &&
        !/rear-large-crate|cabinet|stock-base/.test(r.id)
      ) {
        g.box([a, floor, z], [b, floor + 0.03, Z], material);
        g.box([a, floor, z], [a + t, floor + h, Z], material);
        g.box([b - t, floor, z], [b, floor + h, Z], material);
        g.box([a, floor, z], [b, floor + h, z + t], material);
        g.box([a, floor, Z - t], [b, floor + h, Z], material);
        g.face(
          [
            [a + t, floor + h - 0.06, z + t],
            [a + t, floor + h - 0.06, Z - t],
            [b - t, floor + h - 0.06, Z - t],
            [b - t, floor + h - 0.06, z + t],
          ],
          g.skin([x + 2, y + 2, X - 2, y + bh * 0.45]),
        );
      } else
        g.box(
          [a, floor, z],
          [b, floor + h, Z],
          material,
          top,
          g.skin([x + 1, y + bh * 0.35, X - 1, Y - 2]),
        );
      consume(r.rect);
    } else if (/logs|log-stock|log-bundle/.test(r.id)) {
      for (let i = 0; i < 3; i++) {
        const R = bw / 32 / 7,
          xx = x / 32 + R + (i % 2) * R * 2.2;
        g.lathe(
          [xx, 0, cz + (i === 2 ? 0.12 : -0.07)],
          R,
          h * (i === 1 ? 1 : 0.8),
          material,
          top,
        );
      }
      consume(r.rect);
    } else if (r.id === "spinning-wheel") {
      const wood = g.patch([76, 100, 87, 113], false, "wood");
      const z = 2.66,
        cy = 0.49,
        xc = 2.52;
      g.wheel([xc, cy, z], 0.3, wood, 0.08, 10);
      for (const X of [2.22, 2.83])
        g.beam([X, 0.035, 2.85], [xc, 0.5, z], 0.035, wood);
      g.beam([xc, cy, z - 0.26], [xc, cy, z + 0.1], 0.035, wood);
      g.beam([2.1, 0.22, 2.36], [2.85, 0.22, 2.36], 0.04, wood);
      for (const z of [2.55, 2.87])
        g.beam([2.05, 0.035, z], [2.05, 0.52, z], 0.035, wood, 4);
      g.lathe([2.05, 0.46, 2.61], 0.095, 0.2, wood, wood, "spool", true);
      g.beam([2.05, 0.46, 2.55], [2.05, 0.46, 2.87], 0.018, wood);
      g.beam([2.05, 0.46, 2.72], [2.52, 0.49, 2.66], 0.012, wood, 4);
      g.box([2.1, 0.035, 2.45], [2.36, 0.065, 2.88], wood);
      consume(r.rect);
    } else if (r.id.endsWith("pestle")) {
      g.beam(
        [cx - 0.06, floor + 0.09, cz + 0.15],
        [cx + 0.06, floor + 0.35, cz - 0.05],
        0.04,
        material,
      );
      consume(r.rect);
    } else if (r.id === "rear-quiver-shafts") {
      g.cutout(r.rect, [2.65, 0.31, 0.48], 0.4, 0.3, 0.025);
      consume(r.rect);
    } else if (r.id === "front-long-bow-stock") {
      g.decal(r.rect, [x / 32, (y - 32) / 32, X / 32, (Y - 32) / 32], 0.035);
      consume(r.rect);
    } else if (r.id === "front-right-caddy-handle") {
      const yy = 0.8,
        z = 2.22,
        left = 2.2,
        right = 2.63,
        wood = g.patch([72, 88, 93, 92], false, "wood");
      for (const xx of [left, right])
        g.beam([xx, 0.59, z], [xx, yy, z], 0.035, wood, 4);
      g.beam([left, yy, z], [right, yy, z], 0.025, wood, 4);
      consume(r.rect);
    } else if (r.id === "rack-frame") {
      const wood = g.patch([32, 4, 35, 28]),
        left = x / 32,
        right = X / 32 - 0.06,
        z = 0.2;
      for (const a of [left, right]) {
        g.box([a, 0, z], [a + 0.055, 0.82, z + 0.06], wood);
        g.box([a - 0.06, 0, z - 0.1], [a + 0.11, 0.035, z + 0.2], wood);
      }
      g.box([left, 0.76, z], [right + 0.055, 0.815, z + 0.06], wood);
      g.box([left, 0.19, z], [right + 0.055, 0.23, z + 0.06], wood);
      // Native hanging cloth retains its alpha gaps on a genuinely open stand.
      for (let a = x + 3; a < X - 3; a++)
        for (let b = y + 5; b < Y; b++) {
          const j = (b * W + a) * 4;
          if (source[j + 3] < 100) continue;
          const p = a / 32,
            q = p + 1 / 32,
            topY = 0.77 - (b - y - 5) / 45,
            bottom = topY - 1 / 45;
          g.face(
            [
              [p, topY, z + 0.065],
              [p, bottom, z + 0.065],
              [q, bottom, z + 0.065],
              [q, topY, z + 0.065],
            ],
            g.skin([a, b, a + 1, b + 1]),
          );
        }
      consume(r.rect);
    } else if (r.id === "rear-net") {
      const wood = g.patch([91, 18, 94, 43]);
      for (const X of [1.25, 2.88])
        g.beam([X, 0, 0.47], [X, 0.72, 0.47], 0.025, wood);
      // The net is a thin native surface; its transparent holes stay open.
      g.face(
        [
          [1.27, 0.71, 0.48],
          [1.27, 0.35, 0.48],
          [2.87, 0.35, 0.48],
          [2.87, 0.71, 0.48],
        ],
        g.skin([41, 16, 94, 32]),
      );
      consume([39, 16, 96, 32]);
    } else if (r.id.includes("cage")) {
      const bar =
        type === "WORKSHOP_KENNEL"
          ? r.id.includes("metal")
            ? g.patch([117, 95, 119, 102])
            : g.skin([14, 137, 23, 139])
          : material;
      const z = cz - 0.18,
        Z = cz + 0.18,
        a = x / 32,
        b = X / 32;
      for (const yy of [0.03, h]) {
        for (const zz of [z, Z]) g.beam([a, yy, zz], [b, yy, zz], 0.02, bar, 4);
        for (const xx of [a, b]) g.beam([xx, yy, z], [xx, yy, Z], 0.02, bar, 4);
      }
      for (let xx = a; xx <= b + 0.01; xx += 0.12)
        for (const zz of [z, Z])
          g.beam([xx, 0, zz], [xx, h, zz], 0.015, bar, 4);
      for (const xx of [a, b])
        for (let zz = z; zz <= Z; zz += 0.12)
          g.beam([xx, 0, zz], [xx, h, zz], 0.015, bar, 4);
      consume(r.rect);
    } else if (/peg|rope-post/.test(r.id)) {
      g.beam(
        [cx, 0, cz],
        [cx, h, cz],
        type === "WORKSHOP_KENNEL" ? 0.05 : 0.025,
        material,
        6,
      );
      if (r.id.includes("rope"))
        g.wheel([cx + 0.06, h * 0.6, cz + 0.05], 0.11, top, 0.024, 0);
      consume(r.rect);
    } else if (r.id === "right-crown") {
      const gold = g.patch([70, 21, 90, 33]);
      const z = 0.32,
        c = 2.5,
        base = 0.38,
        rad = 0.29;
      g.lathe([c, base, z], rad, 0.11, gold, gold, "open");
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          xx = c + rad * 0.9 * Math.cos(a),
          zz = z + rad * 0.9 * Math.sin(a);
        const ta = a - 0.17,
          tb = a + 0.17,
          point = (
            angle: number,
            R: number,
            Y: number,
          ): [number, number, number] => [
            c + R * Math.cos(angle),
            Y,
            z + R * Math.sin(angle),
          ];
        const l = point(ta, rad, base + 0.08),
          r = point(tb, rad, base + 0.08),
          tip: [number, number, number] = [xx, base + 0.3, zz];
        g.face([l, r, tip, tip], gold);
        const L = point(ta, rad - 0.04, base + 0.08),
          R = point(tb, rad - 0.04, base + 0.08),
          T = point(a, rad - 0.04, base + 0.3);
        g.face([R, L, T, T], gold, 0.8);
        g.face([l, tip, T, L], gold, 0.85);
        g.face([tip, r, R, T], gold, 0.85);
      }
      consume(r.rect);
    } else if (
      r.kind === "rack" &&
      type !== "WORKSHOP_SIEGE" &&
      !r.base &&
      !r.id.startsWith("rack-")
    ) {
      g.cutout(r.rect, [cx, floor, cz], bw / 32, h, 0.045);
      consume(r.rect);
    }
  };
  const regions = nativeRegions[type];
  if (regions) for (const region of regions) prop(region);
  if (type === "WORKSHOP_FARMER") {
    g.cutout(
      [69, 19, 84, 30],
      [2.42, 0.38, 0.34],
      0.42,
      0.19,
      0.015,
      (r, green, b) => green > r * 1.2 && green > b * 1.2,
    );
    g.decal([83, 32, 95, 52], [2.64, 0.52, 2.96, 0.94], 0.015);
    consume([68, 19, 95, 52]);
  }
  if (type === "WORKSHOP_CLOTHES" && hasArt([4, 93, 31, 117])) {
    const cap = g.patch([13, 99, 18, 101]);
    for (const [x, z, h, r] of [
      [0.28, 2.62, 0.24, [7, 106, 11, 112]],
      [0.55, 2.38, 0.4, [22, 94, 25, 101]],
      [0.78, 2.69, 0.23, [24, 110, 28, 114]],
      [0.5, 2.78, 0.21, [14, 105, 17, 111]],
    ] as [number, number, number, Rect][])
      g.lathe([x, 0.2, z], 0.095, h, g.patch(r), cap, "spool");
  }
  if (type === "WORKSHOP_CRAFTS" && hasArt([63, 93, 94, 112])) {
    const stone = g.patch([71, 98, 77, 103]),
      pale = g.patch([72, 94, 78, 96]);
    g.lathe([2.23, 0.19, 2.43], 0.085, 0.3, stone, pale, "pipe");
    g.lathe([2.53, 0.19, 2.63], 0.12, 0.15, stone, pale, "rock");
    g.beam([2.61, 0.23, 2.65], [2.82, 0.44, 2.43], 0.035, pale, 5);
    g.box([2.64, 0.24, 2.46], [2.77, 0.36, 2.58], stone, pale);
  }
  if (type === "WORKSHOP_DYER") {
    for (const [x, r] of [
      [0.26, [6, 99, 13, 109]],
      [0.52, [14, 99, 21, 109]],
      [0.8, [23, 99, 30, 110]],
    ] as [number, Rect][]) {
      const skin = g.patch(r);
      g.lathe([x, 0.38, 2.27], 0.085, 0.29, skin, skin, "jug");
    }
    consume([5, 93, 31, 112]);
  }
  if (type === "WORKSHOP_KITCHEN") {
    g.cutout([8, 14, 22, 26], [0.51, 0.55, 0.38], 0.4, 0.17, 0.06);
    consume([8, 14, 22, 26]);
  }
  if (type === "WORKSHOP_ASHERY") {
    const start = g.faces.length;
    const wood = g.patch([48, 54, 58, 59], false, "wood");
    g.lathe(
      [1.75, 0.48, 1.23],
      0.23,
      0.24,
      wood,
      g.patch([49, 50, 61, 53], false, "dark"),
      "pail",
    );
    // A separate tilted insert projects from the loaded central barrel.
    for (const f of g.faces.slice(start))
      for (let i = 0; i < f.positions.length; i += 3) {
        const x = f.positions[i] - 1.75,
          y = f.positions[i + 1] - 0.48;
        f.positions[i] = 1.75 + x * Math.cos(-0.3) - y * Math.sin(-0.3);
        f.positions[i + 1] = 0.48 + x * Math.sin(-0.3) + y * Math.cos(-0.3);
      }
  }
  if (type === "WORKSHOP_STILL") {
    const pale = g.patch([47, 105, 51, 113]);
    for (let i = 0; i < 6; i++) {
      const x = 1.43 + (i % 3) * 0.13,
        z = 2.55 + Math.floor(i / 3) * 0.17;
      g.beam(
        [x, 0.2, z],
        [x + 0.07, 0.47 + (i % 2) * 0.05, z - 0.06],
        0.035,
        pale,
        6,
      );
    }
  }
  if (type === "WORKSHOP_LOOM") {
    g.lathe(
      [2.55, 0.41, 2.52],
      0.135,
      0.3,
      g.patch([80, 100, 88, 110]),
      g.patch([80, 95, 86, 101]),
      "barrel",
      true,
    );
    consume([75, 91, 91, 113]);
  }
  if (type === "WORKSHOP_BOWYER") {
    g.decal([27, 108, 50, 125], [27 / 32, 76 / 32, 50 / 32, 93 / 32], 0.025);
    consume([27, 108, 50, 125]);
  }
  // Furnaces use individual containers and small flat supplies around the shell.
  if (type.startsWith("FURNACE_")) {
    consume([0, 0, W, 76]);
    const wood = type.includes("WOOD"),
      glass = type.includes("GLASS"),
      kiln = type.includes("KILN");
    if (wood)
      prop({ id: "coal-barrel", rect: [3, 35, 29, 78], kind: "vessel" });
    else
      for (let y = 57; y < 88; y++)
        for (let x = 0; x < 33; x++) mask[y * W + x] = 0;
    if (wood) {
      const coal = g.patch([6, 47, 23, 57], false, "dark");
      for (const [x, z, h] of [
        [0.33, 1.12, 0.12],
        [0.54, 1.08, 0.16],
        [0.68, 1.25, 0.1],
      ])
        g.lathe([x, 0.46, z], 0.14, h, coal, coal, "rock");
      prop({ id: "front-logs", rect: [2, 91, 23, 125], kind: "rack" });
      prop({ id: "front-axe-pail", rect: [75, 111, 92, 126], kind: "vessel" });
      const handle = g.patch([71, 91, 89, 113], false, "wood");
      g.beam([2.6, 0.25, 2.72], [2.26, 0.58, 2.84], 0.025, handle);
      g.beam(
        [2.54, 0.29, 2.68],
        [2.7, 0.29, 2.68],
        0.06,
        g.patch([80, 107, 88, 115], false, "stone"),
        4,
      );
      consume([72, 91, 94, 126]);
    } else {
      if (!glass && !kiln)
        prop({ id: "right-pail", rect: [72, 71, 94, 94], kind: "vessel" });
      if (glass || kiln) {
        if (glass) {
          const rim = g.patch([66, 85, 92, 89], true);
          g.box([2.04, 0, 1.75], [2.97, 0.06, 2.97], rim);
          g.decal([66, 89, 95, 125], [2.08, 1.8, 2.94, 2.94], 0.065);
          for (const x of [2.04, 2.94])
            g.box([x, 0.04, 1.75], [x + 0.03, 0.13, 2.97], rim);
          for (const z of [1.75, 2.94])
            g.box([2.04, 0.04, z], [2.97, 0.13, z + 0.03], rim);
          consume([65, 85, 96, 128]);
        }
        prop({
          id: glass ? "front-left-sack" : "front-left-jug",
          rect: [2, 91, 23, 122],
          kind: glass ? "sack" : "vessel",
        });
        prop({
          id: glass ? "front-second-sack" : "front-second-jug",
          rect: [18, 103, 36, 127],
          kind: glass ? "sack" : "vessel",
        });
        prop({
          id: "front-jug",
          rect: glass ? [48, 92, 67, 123] : [48, 93, 69, 123],
          kind: "vessel",
        });
        if (kiln) {
          prop({ id: "right-jug", rect: [66, 103, 87, 126], kind: "vessel" });
          prop({
            id: "rear-open-pot",
            rect: [66, 82, 94, 108],
            kind: "vessel",
          });
        }
      } else {
        const side = g.skin([17, 100, 24, 103]),
          top = g.skin([15, 94, 22, 98]);
        for (const [x, z] of [
          [0.3, 2.13],
          [0.62, 2.13],
          [0.48, 2.65],
          [0.8, 2.65],
        ]) {
          const a = x - 0.14,
            b = x + 0.14,
            c = z - 0.24,
            d = z + 0.24;
          g.box([a, 0.015, c], [b, z < 2.4 ? 0.22 : 0.14, d], side, top);
        }
        consume([0, 89, 37, 128]);
        prop({ id: "front-open-tray", rect: [39, 104, 70, 125], kind: "box" });
        prop({ id: "front-open-bin", rect: [74, 104, 94, 125], kind: "box" });
      }
    }
  }
  return {
    faces: g.faces,
    mask,
    authored: !!regions || type.startsWith("FURNACE_"),
  };
}
