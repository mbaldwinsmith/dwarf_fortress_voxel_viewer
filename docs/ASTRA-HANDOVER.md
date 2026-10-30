# Astra handover: workshop fidelity iteration

Saved 2026-10-30 at the user's request: “Save what you've got and prepare a handover for Astra!”

## Objective and honest status

The user requested an independent furniture critic to compare **every 3D workshop/furnace/depot with its original native sprite**, score each out of 5, and iterate until **each of the 33 profiles scores at least 4.8**. The user explicitly allows **flat native item/tool textures on raised 3D tables**. Large machinery, vessels and frames still need coherent geometry.

**The objective is unfinished. Do not report all models passed.** The last full critic review was `native5`: **0/33 passed, scores 2.5–4.0**. See [workshop-critic-review.md](workshop-critic-review.md) for every score and specific correction. Later changes fix some shared problems but have not received new scores.

This work is saved on branch `wip/workshop-fidelity-handover`, based on main commit `7ce8755` (“Model all vanilla workshop and furnace layouts in 3D”). Preserve this checkpoint; finish review and corrections before merging to main. The user's standing instruction is to commit and push completed work to main.

## Constraints

- Repo: `C:/Users/ecoch/OneDrive/Documents/Dev/JavaScript/dwarf_fortress_voxel_viewer`.
- Remote: `https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer`.
- **Use the dev preview. Do not build installers each iteration.** `npm run build` is ordinary TypeScript/Vite/bridge verification and does not build an installer.
- **All artwork must continue to come from the user's local vanilla DF installation**, not ship in the app. No vanilla sprite sheets were added to the repository. QA screenshots under ignored `artifacts/` are local references, not packaged assets.
- DF installation: `C:/Program Files (x86)/Steam/steamapps/common/Dwarf Fortress`.
- Read-only DFHack queries are authorized. Do not modify the fortress for tests.
- Do not inflate critic scores to hit the target. Keep per-profile failures explicit.

## Code in this checkpoint

- `src/bridge/scenery.ts`: exposes full native completed base/decor mosaic refs in `workshop.art`, including decorative top row; supplies a native flat footprint `workshop.floor` ref instead of printing ghost workshop structure on the floor.
- `src/shared/model.ts`, `validation.ts`: optional `workshop.art` and `workshop.floor` metadata and validation.
- `src/viewer/native-workshop-relief.ts`: **prototype** native-art-driven geometry generator. It reads RGBA and emits `FurnitureFace[]` in local workshop coordinates. Detects/splits neutral work surfaces, raises tabletops on legs, maps small native details flat, creates vessels and authored machinery regions. Much of its automatic connected-component inference remains too crude; see critique.
- `src/viewer/native-workshop-worker.ts`: caches local sheet pixels, crops native mosaics, estimates common background, and generates geometry off the rendering thread.
- `src/viewer/native-workshops.ts`: local image decode, deduplicated sheet transfer and per-layout jobs, worker lifecycle and disposal. Does not bundle images.
- `src/viewer/workshop-models.ts`: bounded 96-entry native-layout override registry keyed by type/dimensions/art/material. Existing authored manual recipes remain the fallback. Existing per-tile clipping prevents geometry leaking into hidden footprint cells/across chunk ownership.
- `src/viewer/scenery.ts`: requests native layouts automatically and rebuilds only still-current chunks/groups when jobs finish. Exposes `nativeWorkshop()` used by early fixture galleries; production uses the actual worker loader.
- `tests/native-workshops.test.ts`: meaningful regression checks for horizontal L counters, raised flat tools, cell clipping, duplicate jobs and disposal of queued work.

### Latest changes after the scored native5 round

- Native pipeline is now wired into the actual viewer, not just the screenshot injection fixture.
- Worktop detection now targets the native neutral fill RGB **165,166,165** and decomposes L-shaped surfaces into rectangles. Original connected bounding-box density rejection was causing upright counter walls.
- Excludes the entire source counter region plus its border from subsequent upright base-art extrusion, to remove leftover floating rails. **This last border fix was made after runtime6; verify runtime7.**
- Furnaces use a rounded parametric shell instead of a contour extrusion. Rear masonry uses an opaque native patch. **Aperture/fire placement and exact native furnace profiles still need work.**
- Still has separate horizontal triangular cask stack, receiver, pipe and tapered copper vessel. Fire uses a thin upright native cutout; front supplies now use open crates rather than solid printed slabs.
- Loom has an open rear support frame, side spools and separated foreground basket/thread. Main weaving body still relies heavily on thin native extrusion and needs coherent rollers/treadles.
- Depot has explicit supported horizontal wooden side tables, centre desk/stools and individual rear containers. **This authored replacement was added after runtime6 and needs visual review.**
- Quern/millstone/press have connected authored shafts/handles/posts instead of detached pixel cutouts, and cleaner native stone cap crops. **Also new after runtime6; review current images.**
- Native box sides use opaque interior patches instead of sampling transparent silhouette margins; merged clusters can still form inappropriate cuboids and must be split into physical objects.

## Critic and review evidence

Furniture critic agent canonical name: `/root/furniture_critic`. It was explicitly requested by the user. It has written the tracked review doc; do not treat self-review/tests as the requested independent rating.

Rubric: composition/silhouette 2.0; native texture/color 1.25; defining props 1.0; coherent geometry/grounding 0.75. Every profile must reach 4.8 separately.

The critic completed a native source-region plan for merged clusters in Farmer, Tanner, Dyer, Ashery, Clothier, Fishery, Leatherworks and Soap Maker: **109 regions**, saved in tracked [workshop-native-regions.json](workshop-native-regions.json) (also present under local `artifacts/`). It is critique guidance, not yet integrated production code. It uses half-open source pixel rectangles in a 96×128 mosaic (includes decorative top row); overlapping regions need alpha masks/priority to avoid duplicating occluding objects. Bounds are approximate to ±1–2 pixels. The critic stopped further review for this handover.

Local ignored artifacts (these persist in this checkout but do not travel with git):

- `artifacts/workshop-gallery-data.ts`, `workshop-gallery.json`: all 33 supported profiles through actual bridge `buildingObjects` using read-only definitions.
- `artifacts/workshop-reference-data.ts`, `workshop-reference.json`: complete native base+overlay comparison mosaics. Material recolor is stripped as a neutral control, so comparisons isolate native colors and geometry.
- `artifacts/workshop-critic-boards.mjs <round>`: creates **33 individual 1800×720 comparison boards**: native sprite, orbit, ground. `baseline` uses manual models. `native*` injects the generator. **`runtime*` uses actual viewer worker loading**, then awaits all layout jobs before capturing.
- `artifacts/workshop-review-native5/`: last independently scored complete round.
- `artifacts/workshop-review-runtime6/`: all 33 actual-runtime boards; no browser errors. Countertops are horizontal, but stale border rails, upright depot tables and several connected single-tile parts were still wrong. Those received subsequent source fixes.
- `artifacts/workshop-review-runtime7/`: latest checkpoint capture, **33 boards completed, no browser errors**. This round is **not independently rated**.
- `artifacts/native-part-stats.json` and `native-part-stats-4.json`: source component bounds; useful but a connected alpha component is often several physical objects.
- `artifacts/counter-colors.mjs`: confirms native worktop fill RGB, distinct from floor RGB 107,112,118.

**Disregard `native1` as evidence**: it accidentally captured baseline due Vite HMR duplicate module registries. Early fixture imports of `/workshop-models.ts` could register into a different HMR module instance than the scene. `scene.scenery.nativeWorkshop()` fixed injected captures; actual runtime captures avoid this problem.

## Most important remaining corrections

1. Review current `runtime7` counters/depot/single-tile machinery before assigning more tasks. Check both orbit and ground; no floating rails, broken posts or blank side panels.
2. Split large connected prop clusters into individual vessels, sacks, crates, racks and frames. Automatic full-component cuboids create “picture walls” with blank roofs. Use critic region JSON and exact native source crops.
3. Furnaces need convincing native arch/aperture, visible fire, appropriate chimney and variant-specific side columns. Current hemispheres improve roofs but do not resolve the full identity.
4. Forge needs coherent connected hearth and a genuine anvil top/waist/feet; current anvil is a shallow native silhouette extrusion. Magma forge duct must join rather than float.
5. Mechanic needs real shafts/gears/post depth. Loom needs rollers/heddles/treadles. Butcher/clothier/fishery need actual open racks/net supports, with thin native hanging art.
6. Use clean material crops for inferred tops/sides; a painted perspective sprite already contains top/front information, so projecting it wholesale duplicates handles or stretches contour pixels into stripes.
7. Keep all geometry within a z-level's available headroom and footprint. The stacked still barrel was lowered to centreY .58, radius .24. Maintain per-cell hidden clipping and cache keys independent of world position.
8. Re-run the critic on **all 33 actual-runtime boards** after repairs; document individual scores, iterate honestly to 4.8 each, then merge/commit/push completed work to main.

## Validation at checkpoint

- **233 tests passed across 42 test files.**
- **`npm run build` passed** (TypeScript, Vite viewer including dedicated workshop worker, bridge compile). Existing Vite large-bundle advisory remains; no installer was built.
- Earlier actual-runtime round `runtime6`: **33 boards, no browser errors**.
- Latest actual-runtime round `runtime7`: **33 boards, no browser errors**. The last source changes were captured before this checkpoint.
- Changed source/tests/docs formatted; `git diff --check` passed. Full format check performed before committing.

## Commands and preview

Dev viewer: `http://127.0.0.1:5173/`; companion `127.0.0.1:4174`; DFHack `127.0.0.1:5000`. Existing dev processes were left running so the user/Astra can continue in the same checkout. Do not launch duplicate servers blindly.

Use Node 24, as system PATH may resolve an older Node:

```powershell
$node = 'C:/Users/ecoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PATH = 'C:/Users/ecoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin;' + $env:PATH
& $node node_modules/vitest/vitest.mjs run
& $node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build
& $node artifacts/workshop-critic-boards.mjs runtime8
```

Gallery script uses bundled Playwright at `C:/Users/ecoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs` and headless Edge. It isolates `/live` WebSocket with only ping/pong replies; it does not mutate the game. Vite root is `src/viewer`, so browser imports are `/native-workshop-relief.ts`, **not** `/src/viewer/native-workshop-relief.ts`.

**Freeze viewer source while gallery capture runs.** HMR can silently invalidate captures; wait for script completion before editing source again. Generated QA sheets remain ignored and are not app assets.
