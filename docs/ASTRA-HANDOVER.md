# Astra handover: native workshop fidelity

Updated 2026-10-30 after continuing the original handover. The earlier checkpoint remains in commit `b763e54`; intermediate verified work is saved in `9c52ea0` on `wip/workshop-fidelity-handover`.

## Objective and current status

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
