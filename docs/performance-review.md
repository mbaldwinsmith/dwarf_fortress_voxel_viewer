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

DFHack was offline during the original optimisation pass. The live follow-up
below covers streaming, navigation and a short memory observation; actual combat
and an extended unpaused session remain unverified. No fortress data was changed.

Ignored local evidence and reproduction scripts: `artifacts/performance-browser.mjs`,
`performance-before.json`, `performance-final.json`, corresponding PNGs,
`performance-cache.ts`, `performance-cache-before.json`,
`performance-cache-digests.json`, `performance-framing.ts`,
`performance-framing.json`, `performance-bundle-smoke.mjs`,
`performance-mock-rfr.mjs` and `performance-bundle-smoke.json`.
Use the bundled Node runtime and the existing dev preview. Freeze production
source while taking comparisons. The bundle smoke uses a mock RFR server and
does not connect to the game.

## Live follow-up — 2026-10-31

The user reopened DF with DFHack. A roughly five-minute read-only audit used the
actual dev viewer, native artwork and bridge, with headless Edge at 1280×800.
The handshake reported DF **53.16**, DFHack **53.16-r3** and RemoteFortressReader
**0.21.0**. `GetPauseState` confirmed the fortress was paused before and after;
its native screen coordinates also remained unchanged. The viewer sent no mining
requests. Changing the viewer camera/cutaway does not move the game's camera.

| Live measurement                                                   |                           Result |
| ------------------------------------------------------------------ | -------------------------------: |
| Loaded map window                                                  |       2,304 blocks; 56 creatures |
| Initial complete terrain sweep                                     |                           24.6 s |
| Two settled sweeps with no changed terrain                         |                    19.9 / 20.4 s |
| Projectile snapshots                                               | 2,104; median 126 ms, p95 173 ms |
| Creature snapshots                                                 |   801; median 301 ms, p95 517 ms |
| Four-second walking sample: scene-loop CPU                         |        mean 7.36 ms, p95 12.1 ms |
| Walking sample: animation-callback interval                        |       median 7.9 ms, p95 14.1 ms |
| Same surface view after repeated level changes: page heap after GC |                    30.6–31.1 MiB |
| Same surface view: renderer resources                              |     598 geometries / 15 textures |
| Browser errors / warnings                                          |                            0 / 0 |

The audit exercised spawn selection, WASD movement across a ramp, returning to
orbit, and cut levels 175, 173, 169 and 174, including repeated returns. Full-map
terrain sweeps remain much slower than near-camera creature/projectile polling.
Initial loading and level changes still cause transient frame-time spikes. CPU
submission times are not measurements of GPU completion or native game FPS.

The bounded tree cache stayed below 32 MiB. Returning to the same surface view
did not increase the renderer's geometry/texture counts on the repeated cycle.
The companion ended around 512 MiB working set / 530 MiB private memory with its
warm block/art caches; it is still a substantial part of the total footprint.
These observations do not establish long-session leak freedom. Page heap figures
exclude workers, external typed-array backing stores and browser overhead.

No live flights or fire flows occurred while DF was paused. A separate isolated
browser replay, using local native-art references and no game connection, checked
all five projectile forms, interpolation, stationary samples, landing removal,
stale expiry, fire/smoke animation and return to idle rendering.

That replay exposed a scheduling regression: interpolation could stop just short
of its endpoint when the next animation callback arrived after its deadline. The
projectile renderer now requests work until the displayed position reaches the
latest sample, and copies the endpoint exactly on the final frame. The new test
failed before the fix and passes afterwards. The browser replay reached the
exact endpoint, removed landed/stale objects, animated both flows, then returned
to four renders in one idle second. **264 tests in 46 files and the production
build passed.** No installer was built.

Remaining checks: moving units during normal unpaused play, actual shots and
siege ammunition, naturally occurring effects, and a longer memory soak.
Ignored reproduction/evidence: `artifacts/live-performance-20261031.mjs`,
`live-performance-20261031.json`, `live-performance-*.png`, `read-pause.ts`,
`effects-scheduler-20261031.mjs` and `effects-scheduler-20261031.json`.
