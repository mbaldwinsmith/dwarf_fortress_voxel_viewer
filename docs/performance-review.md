# Resource optimisation — 2026-10-30

The audit covered DFHack framing and polling, chunk storage and transport,
validation, scene scheduling, terrain/tree/fungus geometry, native workshop
workers, sprites/palettes, liquids/flows/projectiles, navigation/mining, local
asset serving and desktop packaging. Authored model shapes and texture resolution
are preserved. Existing releases and visual-review evidence were not deleted.

## Measured results

The same saved 144-block live grove, camera, 1280×800 viewport and headless Edge
were used before and after. Hardware: Intel UHD Graphics, ANGLE D3D11. These are
controlled local measurements, not live DFHack frame-rate claims.

| Measurement                     |    Before |     After |
| ------------------------------- | --------: | --------: |
| Scene geometry buffers          | 40.94 MiB | 16.35 MiB |
| Geometry vertices               | 1,346,718 |   438,469 |
| Rendered triangles              |   351,242 |   351,242 |
| Draw calls per rendered frame   |       112 |       112 |
| Main-page JS heap after GC      | 26.10 MiB | 13.65 MiB |
| Renders during six idle seconds |       868 |        24 |
| Mean scene-loop CPU time        |  1.393 ms |  0.043 ms |
| Mean render submission time     |  1.057 ms |  0.575 ms |
| Initial scene load, single run  |   2.063 s |   1.820 s |
| Terrain atlas RGBA allocation   |    16 MiB |     8 MiB |

Geometry/texture figures describe application buffers, not total driver VRAM.
The JS heap excludes worker heaps, browser process overhead and external buffers.
Timing varies with system load. The unchanged triangle and draw-call counts are
intentional: the optimisation removes duplicate storage/work rather than detail.

Additional controlled checks:

- 2,048 cached blocks: retained comparison/cache overhead fell from 45.78 MiB to
  0.69 MiB. A full store pass increased from about 190 to 259 ms due to digesting;
  item-only refreshes reuse the terrain digest. This is a deliberate memory
  tradeoff, alongside much cheaper viewer change detection.
- An 8 MiB DFHack reply in 16 KiB fragments reassembled in 2.85 ms instead of
  554.59 ms, with identical bytes. The new parser avoids repeated growing copies.
- An isolated production companion, with no `node_modules`, passed startup,
  native-art discovery and a controlled RFR protocol exchange. Four uniform
  textured blocks occupied 4,518 wire bytes versus 328,782 expanded JSON bytes.
  Mixed terrain will compress less.
- The bundled companion plus dependency notices occupies approximately 282 KiB.
  Future desktop packages omit 47.7 MiB of unused Electron locale files, retaining
  en-US/en-GB. Electron itself remains the largest disk component. No installer
  or full desktop release was built in this pass.

## Changes

- `chunk-codec.ts` transmits repeated tiles as a bounded palette and cell indices;
  the receiver shares identical tile objects and still validates visibility.
  Full legacy chunks remain accepted. Published chunks are immutable.
- `ChunkCache` retains SHA-256 digests rather than complete JSON duplicates.
  Terrain stamps let the viewer distinguish scenery-only changes without
  serializing both tile arrays on every update.
- `indexed-geometry.ts` deduplicates identical float-bit attribute tuples in
  terrain and worker-produced trees/fungi. UV seams, colour boundaries, normals
  and triangle order are preserved; unhelpful indexing is skipped. Worker
  buffers are adopted directly, including cap buffers that were previously copied.
- Tree cache keys use interned sparse descriptions instead of concatenated
  neighbouring chunk JSON. Cancelled worker results cannot refill cleared caches.
- Quiet scenes render at most every 250 ms for maintenance. Camera movement,
  input invalidation, terrain work, active effects, projectile motion and texture
  changes render immediately. Movement controls continue updating every animation
  callback. Statistics DOM updates are throttled.
- The same 1,024 atlas slots fit in a 2048×1024 texture, with unchanged 32-pixel
  cells and gutters. Repeated UV lookups use weak object caches.
- Palette recolouring reads/caches individual rows, instead of copying entire
  palette sheets for every layer. Workshop pixel buffers transfer to the worker
  without retaining another decoded main-thread copy. Flow uploads update only
  the populated attribute ranges.
- `build-bridge.mjs` bundles the production companion and dependency notices;
  Electron packages exclude redundant runtime dependency trees and unused locales.

## Validation and next session

**263 tests across 46 files passed**, including new lossless geometry, large-index,
palette validation, hidden-cell, terrain stamp, idle scheduling and fragmented
frame checks. TypeScript and the viewer/worker/companion production build passed.
The existing Vite bundle-size advisory remains.

Browser grove captures completed without errors. The indexed comparison differed
in 252 of 1,024,000 pixels (0.025%), scattered along rasterised edges; the geometry
round-trip test verifies exact vertex attribute bits. The authored tree/workshop
model source was not changed. A fresh full critic gallery was not run in this pass.

The user requested wrapping up and checking **live DFHack performance tomorrow**.
DFHack was offline during the final integration attempt. Actual live sweep rate,
walking through a populated fortress, projectile/fire animation and long-session
memory behaviour remain the next checks. No fortress data was changed.

Ignored local evidence and reproduction scripts: `artifacts/performance-browser.mjs`,
`performance-before.json`, `performance-final.json`, corresponding PNGs,
`performance-cache.ts`, `performance-cache-before.json`,
`performance-cache-digests.json`, `performance-framing.ts`,
`performance-framing.json`, `performance-bundle-smoke.mjs`,
`performance-mock-rfr.mjs` and `performance-bundle-smoke.json`.
Use the bundled Node runtime and the existing dev preview. Freeze production
source while taking comparisons. The bundle smoke uses a mock RFR server and
does not connect to the game.
