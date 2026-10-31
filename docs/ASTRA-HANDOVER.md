# Astra handover: native scenery fidelity

Updated 2026-10-31 after the wall/floor surface critic pass. The earlier checkpoint remains in commit `b763e54`; intermediate verified work is saved in `9c52ea0` on `wip/workshop-fidelity-handover`.

## Completed wall/floor surface follow-on

The user requested wall/floor engravings and smoothed/constructed finishes for
all materials, using vanilla art and a new detailed critic with a 4.8/5 pass bar.
**Complete: all 116 supplied cases pass both model/placement and texture at
4.85/5 or higher.** `/root/surface_critic` independently reviewed every final
case, nine material sheets covering 387 IDs, directional/adjacency controls,
and the actual fortress image. See [surface-critic-review.md](surface-critic-review.md)
for individual scores/iterations and [surface-rendering.md](surface-rendering.md)
for implementation, limitations and source routing.

Stone blocks, boulders, wood, metal, all three glasses and constructed ice retain
their native finishes. Smooth mineral/ore/gem/ice rims use finished art. Native
carved floor motifs form floor tiles and inset vertical wall panels only on
DF-recorded faces; the generic motif does not recreate each historical art
subject. Material palettes, dark-stone contrast, glass alpha backing and native
wood/ice/glass carving tones are coherent across faces and cut edges.

RFR construction-item field 18 is decoded. Engravings use fresh bounded read-only
Lua column snapshots because RFR engraving novelty hashes are global even under
force_reload. Hidden/sealed records remain redacted; refresh/removal/reconnect
cannot retain a stale local engraving list. The lookup scans the world's current
engraving vector; very large engraved fortresses still need live timing checks.

**308 tests across 50 files and production build passed.** The read-only live
viewer loaded 2,304 chunks, 57 creatures and 1,395 smooth tiles with zero browser
errors/warnings. Atlas usage settled at 787 slots/zero pending loads; its GPU
allocation remains 8 MiB, with 1,799 available artwork slots. No visible engraving
or construction was present in that live snapshot; those use controlled render
fixtures plus live read-only lookup transport verification. No fortress changes
or installer build.

Preserve `artifacts/surface-review-final1/` (112 boards),
`surface-review-final3/` (four constructed-ice boards),
`surface-material-swatches-final/` (nine sheets), the material manifest and
`surface-live-final.png/json`. The four final2 boards had a transient 500 during
bridge-restart preload; use final3 as clean acceptance evidence. Source was
frozen during each capture. Existing furniture/workshop/tree model code remains
unchanged. Resolving inherited native metal flags also correctly routes actual
metal furniture to its previously reviewed METAL profiles; 18 native integration
checks cover iron/gold/copper tables, chairs, cabinets, bookcases, statues and
pedestals.

## Completed freestanding furniture follow-on

The user reported over-tall tables/chairs and requested a new furniture critic,
all freestanding furniture rebuilt, and separate model/texture scores of at least
4.8. The user explicitly accepted a textured 3D statue pedestal with a vertical
camera-facing sprite and actual displayed-item sprites on stands/in cases.

**Complete: all 23 families independently pass both model and texture at 4.80/5
or higher.** The new `/root/freestanding_furniture_critic` inspected all 62 native
material variants, four extra sword/amulet display fixtures, the final ten
statue/display billboard checks and the actual fortress view. See
[furniture-critic-review.md](furniture-critic-review.md) for the final matrix and
detailed iteration feedback, and [furniture-rendering.md](furniture-rendering.md)
for implementation, protocol boundaries and limitations.

Tables are .40 high and chair/throne seats .24, calibrated against current dwarf
sprite sizes. Clean native material crops retain grain density; intentional
highlights, doors, shelf details and bedding are placed once. Storage has real
openings, slabs retain their peaked shoulders, and traction benches have attached
ropes/rollers/cranks. Glass panes and native statue/item billboards share the
existing lifecycle and cutaway handling. Display contents use bounded read-only
DFHack assignment/holder checks plus RFR item records; no inventory is invented.
Unknown statue subjects use native covered-statue artwork.

**283 tests across 48 files and production build passed.** The read-only live
viewer audit loaded 2,304 chunks and 57 creatures with zero browser errors or
warnings. It included 21 tables, 21 chairs, 14 beds, six nest boxes, 12 barrels
and nine pots. No occupied display was available in the queried live viewport;
its rendering/fit is verified with crown, sword and amulet fixtures, and the
fixed Lua transport/missing-building guard passed separately. No fortress changes
or installer build.

Preserve `artifacts/furniture-review-final1/` (66 boards),
`artifacts/furniture-review-final3/` (10 billboard boards) and
`artifacts/furniture-live-final.png/json`. The four statue boards in `final2`
are invalid loading-marker captures. The harness now preloads local artwork
and waits for actual scenery sheet images rather than placeholders. Existing
workshop `runtime20` and tree `runtime10` evidence remains unchanged.

## Live follow-up checkpoint

The user reopened DF/DFHack on 2026-10-31. A roughly five-minute read-only audit loaded 2,304 blocks and 56 creatures, exercised first-person walking/ramp traversal and repeated cutaway changes, and recorded no browser errors. Initial terrain sweep: 24.6 s; settled unchanged sweeps: about 20 s. Projectile snapshot cadence: 126 ms median / 173 ms p95. Returning to the same surface view retained about 31 MiB page JS heap after GC and the same 598 renderer geometries / 15 textures. Companion working set remained substantial at about 512 MiB. See [performance-review.md](performance-review.md) for scope and measurement limits.

DF was paused throughout, so actual moving-unit/combat/effect performance remains unverified. A separate native-art replay exposed and verified a fix for the idle scheduler skipping the final projectile interpolation frame. Flights now render through the exact endpoint before idling. Fire/smoke, landing removal and stale expiry also passed the isolated replay. **264 tests in 46 files and production build passed.** No fortress changes, game camera changes, mining requests or installer build. Next: normal unpaused play, actual projectiles/effects, and an extended memory soak. Dev preview/companion remain available on ports 5173/4174; the automated browser was closed.

## Resource optimisation checkpoint

The user's optimisation pass is implemented and validated; see [performance-review.md](performance-review.md). Controlled grove measurements: geometry buffers 40.94 to 16.35 MiB, main-page JS heap 26.10 to 13.65 MiB, and 868 to 24 renders over six idle seconds, preserving 351,242 rendered triangles. Improvements cover chunk palettes/digests, lossless vertex indexing, worker cache/buffer ownership, idle scheduling, palette rows, an 8 MiB smaller atlas, linear-time RPC reassembly and production bundling. Future desktop packages omit 47.7 MiB of unused locales. Existing release artifacts and critic evidence are preserved.

**263 tests in 46 files and production build passed at this checkpoint.** The isolated production bundle passed a controlled RFR exchange without `node_modules`. DFHack was offline then; the subsequent live follow-up is recorded above. No installer or full fresh critic gallery was built/run during this pass.

## Completed physical projectiles follow-on

Arrows, bolts, thrown items and siege ammunition now have a dedicated stream and renderer. `bridge/projectiles.ts` resolves item definitions and native artwork; `viewer/projectiles.ts` draws directional crossed native ammunition with solid shafts, material-coloured stones and native thrown items. The protocol now decodes RFR's fractional position, velocity and volume fields.

A single allocated block supplies RFR's global projectile list. Polls target 75 ms on the existing serial RPC connection, with world checks, mining priority, empty snapshots and no polling without viewers. Movement interpolates observations, never extrapolates velocity; stationary samples settle, landed items disappear from flight, stale objects expire after 1.5 seconds, and resets clear everything. Visibility follows the loaded/revealed terrain cache and cut level.

Validation: **255 tests across 45 files**, TypeScript and production build passed. Native-art browser fixtures cover arrows, bolts, ballista bolts, stones and axes, with moving/paused/landing replay checks. A 20-second live read-only audit received 148 snapshots at 121 ms median / 161 ms p95 during terrain loading; no live shots occurred, so actual combat was not witnessed. See [projectile-rendering.md](projectile-rendering.md) for sources, limits and reproducible local QA. No native artwork or QA screenshots are committed; no installer or fortress modifications were made.

## Completed tree follow-on

The user's subsequent request was to improve trees with a specialised Tree Critic subagent, detailed feedback and iteration toward 4.8+/5. **Complete:** `/root/tree_critic` independently signed off all 21 controlled family/state fixtures, the actual live grove and the tower-cap regression at **4.80 minimum**, with pine, cedar and larch at **4.85**. See [tree-critic-review.md](tree-critic-review.md) for the complete rubric and detailed feedback.

Nine visual rounds established the passing geometry; `artifacts/tree-review-runtime10/` verifies the final worker path. Rounded connected trunks, sloping bends, tapered branch joins and varied leafy volumes preserve the revealed occupied cells. Native material handling distinguishes empty twigs, spore nodules, cactus tips, hollow tube mouths and fungiwood. Existing tower-cap geometry and workshop models remain unchanged.

Implementation lives in `tree-geometry.ts`, `tree-topology.ts`, `tree-section.ts`, `tree-wood.ts`, `tree-foliage.ts` and `tree-mesh.ts`. `tree-mesher.ts` and `tree-worker.ts` move construction off the rendering thread with coalescing, stale-result protection, priority and a bounded geometry cache. The scene retains old trees during replacement and manages tree/cap children independently. The bridge supplies stable species IDs and appropriate native material references.

Validation: **246 tests across 44 files**, production build and visual worker comparison passed. Focused coverage includes concave/hidden occupancy, chunk seams, directional bare wood, outward foliage and tube-mouth winding, worker UV remapping, deduplication, caching, invalidation and disposal. No installer was built. The live worker audit recorded 3.6 ms p95 / 12.2 ms maximum main-thread request cost and verified cached reuse without rebuilding.

The ignored `tree-live-snapshot.json` is a read-only 144-block snapshot (X32–79, Y48–95, Z171–186). `tree-gallery-data.ts`, `tree-critic-boards.mjs`, `tree-fungi-regression.mjs` and `tree-worker-runtime-audit.mjs` reproduce the local-art review. Keep `runtime10` immutable. Future captures must wait for both `capMesher.pending` and `treeMesher.pending`, as well as an empty scene dirty queue.

## Completed workshop objective

The requested objective is an independent comparison of all 33 workshop, furnace and depot profiles against their native sprites, with **each scoring at least 4.8/5**. Flat native tools, food and cloth on genuinely raised tables are accepted; major structures and machinery need coherent volume and support.

**Objective complete: all 33 profiles independently score 4.8/5 in the final full `runtime20` review.** The critic inspected every native/orbit/ground board and found no regression. The per-profile rubric table and all earlier rounds are recorded in [workshop-critic-review.md](workshop-critic-review.md). Preserve this passing model state and capture as the reference for future changes.

The user's standing instruction is to commit and push completed work to `main`. The checkpoint branch and its history are retained; the fidelity objective requires no further corrections.

## Implementation

- `src/bridge/scenery.ts` supplies completed native base/decor mosaics, including the decorative top row, and a separate floor ref that avoids printing ghost structures beneath 3D objects.
- `native-workshop-relief.ts` combines authored native structures, semantic props and raised work surfaces. Small native details remain on their correct support; automatic component inference remains a fallback.
- `native-workshop-geometry.ts` supplies local-art primitives, opaque material selection, continuous UV projection/tiling, alpha-shaped details, vessels, wheels and continuous swept pipes without internal cap fans.
- `native-workshop-regions.ts` contains semantic bounds and table metadata derived from both tracked source-region plans. No pixels are embedded in it.
- `native-workshop-props.ts` distinguishes open vessels, lidded pots, gathered sacks, cabinets, stools, crates, cages and individual stock. It explicitly handles floor versus tabletop placement.
- `native-workshop-structures.ts` owns the passing Quern, Millstone and Screw Press mechanisms plus furnace domes/arches, fire mouths, chimneys, magma elbows and grilles.
- `native-workshop-machines.ts` owns connected siege assemblies, mechanic gears/shafts, loom, meat rack, kitchen stove and forges. `native-workshop-still.ts` owns the supported boiler, receiver, pipe and cask stack.
- `native-workshop-worker.ts` generates geometry off the rendering thread from local sheet pixels. `native-workshops.ts` deduplicates loads/jobs and handles disposal.
- `workshop-models.ts` keeps the bounded native-layout cache and per-cell clipping; `scenery.ts` rebuilds only current groups when loading finishes. Existing authored models remain the fallback.

The critic's tracked plans are [workshop-native-regions.json](workshop-native-regions.json) and [workshop-native-regions-extra.json](workshop-native-regions-extra.json). All coordinates address the user's original local artwork. Material-only patches exclude neighbouring rims, outlines and perspective objects; inferred faces retain native texel scale.

## Validation and evidence

- **237 tests passed across 42 files.** Regression coverage includes L-shaped counters, overlapping cloth support, local material UVs, continuous pipe bends, hidden-cell clipping, deduplicated jobs and disposal.
- **Production build passed:** TypeScript, Vite viewer/worker, and bridge compile. Existing Vite large-chunk advisory remains. No installer was built.
- `artifacts/workshop-review-runtime20/`: 33 native/orbit/ground comparison boards captured through the actual worker, no browser errors.
- Local-art geometry audit: all 33 profiles finite, within their footprints, maximum height .88. Depot retains the existing .0004 surface offset around ground level.
- All previous critic rounds are retained in `workshop-critic-review.md`; ratings are not inferred from tests or implementation descriptions.
- Critic agent: `/root/furniture_critic`, explicitly requested in the original task. Rubric: silhouette/composition 2.0, native material 1.25, defining props 1.0, geometry/grounding .75.

Ignored local QA files include `artifacts/workshop-critic-boards.mjs`, `workshop-reference.json`, `native-pixels.json`, `native-sources/` and `check-native-layouts.ts`. They remain available in this checkout but are not packaged or pushed. `runtime20` is immutable evidence; use a new round name for future captures.

## Constraints and preview

- Repository: `C:/Users/ecoch/OneDrive/Documents/Dev/JavaScript/dwarf_fortress_voxel_viewer`.
- Remote: `https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer`.
- Artwork must remain loaded from the user's local vanilla DF installation. Do not commit native sprite sheets, crops or QA screenshots.
- DF installation: `C:/Program Files (x86)/Steam/steamapps/common/Dwarf Fortress`.
- Use the dev preview; do not build installers for visual iterations. Read-only DFHack inspection is allowed; do not modify the fortress for tests.
- Viewer: `http://127.0.0.1:5173/`; companion: `127.0.0.1:4174`; DFHack: `127.0.0.1:5000`. Existing dev processes remain running; do not launch duplicates blindly.
- Freeze viewer source while capturing a gallery. HMR can invalidate comparisons. Early `native1` accidentally captured fallback models; disregard it as evidence.

Use the bundled Node 24 runtime:

```powershell
$node = 'C:/Users/ecoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PATH = 'C:/Users/ecoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin;' + $env:PATH
& $node node_modules/vitest/vitest.mjs run
& $node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build
& $node artifacts/workshop-critic-boards.mjs runtime21
```

The gallery uses headless Edge, waits for native layout jobs and isolates `/live` WebSocket to ping/pong responses. It does not mutate the game. Vite's root is `src/viewer`, so browser imports start at `/native-workshop-relief.ts`.
