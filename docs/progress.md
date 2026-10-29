# Progress

## Live terrain milestone — 29 October 2026

Implemented the Node/TypeScript bridge, restricted protobuf RPC adapter, shared
session model and Three.js browser viewer. Actual fortress terrain streams in
bounded blocks, with material-category colours, hidden-tile masking, walls,
floors, generic ramps/stairs, orbit/pan/zoom, cutaway controls and tile inspection.

### Evidence

- Live handshake: DF **53.16**, DFHack **53.16-r3**, RFR **0.21.0**.
- Loaded world: **The Dimension of Tempests**. Initial sampled region:
  X 32–79, Y 112–159, Z 124–128; 45 actual map blocks, not fixtures.
- First block contained 65 floors, 178 walls, 7 empty tiles and 6 ramps.
- First complete sweep: **9,928 ms** at 200 ms between block requests.
  Subsequent observed sweeps: roughly 9.9–10.3 seconds before adding per-block
  before/after map identity checks. This is a small sample, not a benchmark.
- Browser rendered approximately **21,344 triangles**, 45 blocks and zero queued
  mesh rebuilds after settling. Bridge heap observed around **7–8 MB**.
  Browser/GPU memory and game frame-time impact have not been measured.
- Sweep 8 detected one changed block. The user independently confirmed that
  mining updated the viewer. Exact mining coordinates and end-to-end latency
  were not instrumented; expected detection delay is up to a sweep plus meshing.
- Production browser smoke: real terrain visible; keyboard slider changed Z 128
  to 127; tile inspection displayed a vein wall with absolute coordinates.
- 14 automated boundary tests passed: fragmented/coalesced TCP reads, native
  header/error semantics, exact method binding, coordinate indexing, neighbour
  culling/invalidation, cutaway caps, session resets, visibility redaction,
  malformed payloads, definition tokens and public-path restrictions.
- Strict TypeScript check and production build passed. Runtime dependency audit
  reported zero known vulnerabilities; full dependency audit also clean.
- Restarted only the companion: browser displayed the disconnected state, then
  recovered automatically to 45 actual blocks with a fresh session. Both
  production startup and the combined `npm run dev` command were exercised;
  the Vite WebSocket proxy rendered live terrain without browser console errors.
- Final bridge sweeps with per-block identity checks took **10.7–11.0 seconds**.
  A clean `npm ci --ignore-scripts` reproduced the locked dependency tree.

### Limits and next steps

- Live units and simple local sprites were added later (see below). Buildings,
  liquids, exact material identities and layered graphics remain unimplemented.
- The initial fixed region was superseded by full-footprint streaming (see below).
- Ramp direction follows neighbouring walls; trees and fortifications use coarse wall geometry.
  Stair types share a marker geometry. Fluid depths are currently omitted.
- Active world mod order is unresolved. Available module metadata can be inspected,
  but no sprite override order is guessed and no proprietary assets are exported.
- DF world unload/save-switch handling is implemented; an actual game unload or
  different-save switch has not been induced because gameplay is read-only.
- Performance needs longer measurements of update latency, GPU memory and game
  frame times before adjusting polling or adding workers/greedy meshing.
- Next recommended increment: selectable bounded regions and material identities,
  followed by separate unit/building snapshots. Resolve active mod order before
  introducing local sprites. Keep fallback colours usable throughout.

The milestone commit is the commit introducing this file and `src/`; see
`git log -1 --oneline`. Nothing is pushed automatically.

## Ramp orientation correction — 29 October 2026

Replaced the fixed north-facing wedge with neighbour-derived corner heights.
Cardinal walls raise their shared edge; diagonal walls raise the touching corner.
Multiple exits retain slopes and unsupported ramps remain at floor height.
Diagonal chunk updates now invalidate affected corner ramps. Geometry remains a
visual approximation and does not evaluate upper-level pathability.

Verified 21 tests, including four compass directions, diagonal chunk boundaries,
support removal and multiple exits; strict type checking and production build
passed. Live browser smoke verified separately.

## Whole-footprint streaming — 29 October 2026

Live GetMapInfo reports 12 × 12 blocks and 199 levels: 192 × 192 tiles,
28,656 blocks across the entire volume. RFR accepts arbitrary bounded block
coordinates within that map. It does not require a viewport-limited region.

The viewer now streams all XY blocks for the selected Z and two beneath it.
All map levels are selectable. This deliberately limits resident memory and
rendering work; it does not render the full vertical volume simultaneously.
Selected-level changes cancel the previous scan, clear state and create a new
session. Latest selection is shared by all viewer tabs. Snapshots to late joiners
are paced one block at a time instead of one giant message.

25 tests pass, including complete block coverage, ordering, lower-map boundaries,
level-operation validation and full-map reset validation. Strict TypeScript and
production build pass. Browser slider switched live streaming from Z 182 to 181.
The current map requires 432 blocks per complete three-level sweep, versus the
original 45. Update latency consequently increases; no game-FPS claim is made.

Next: profile before increasing polling speed; prioritise changes near the camera
and consider compact block storage for larger vertical volumes.

Live verification completed a 432-block sweep at Z 181–179. A separate late-join
WebSocket client verified every message sequence and confirmed block origins
from (0,0) through (176,176), covering all 192 × 192 tiles. Its join-to-complete
time was 88.8 seconds (not a full-sweep timing). Browser console had no errors;
settled mesh statistics and screenshot were inspected locally.

Measured full sweep: 108,926 ms (about 109 seconds), bridge heap 15 MB.
Settled live browser: 432 blocks, 216,130 triangles, zero queued mesh rebuilds.
Browser/GPU memory and game frame-time impact remain unmeasured.

## Render-view toggle — 29 October 2026

Added accessible DF screen / Whole map radio controls. Screen mode follows
GetViewInfo's current Z and block-aligned viewport, checked every twelve reads.
Whole map retains full-footprint manual cutaways. Mode changes reset sessions;
the choice is shared by connected tabs. Both modes retain three levels.

27 tests pass, covering mode validation and viewport clipping/alignment.
Manual game panning was not induced; the follow logic is tested with synthetic
viewport positions. Browser mode switching and production build checked locally.

## Camera-facing creature sprites — 29 October 2026

Added separate live unit snapshots, race/caste resolution, definition-based local
vanilla simple sprites, bounded asset serving and camera-facing billboard geometry.
Undiscovered/off-map/ambushing units are filtered before transmission. Dwarves
and other layered definitions use original markers. Active mod order remains
unresolved; the UI explicitly labels the vanilla fallback profile. No directional
frames, animation, clothing/equipment or procedural creature compositing yet.

Verified 32 automated tests, strict type checking and production build. Parsed
202 local simple mappings / four sheets. A real local atlas was served as PNG
(106,760 bytes); unknown asset identifiers returned 404. An isolated browser test
used an explicitly labelled synthetic cat position and actual local artwork to
verify cropping, transparency and camera-facing behaviour. It was not a live test,
and its temporary page was removed. An initial texture upload warning was fixed
by keeping the fallback material until image data is ready.

After the user loaded DF, real unit RPC returned 157 active records. The live
viewport stream then reported 50 eligible creatures, 36 with resolved sprites;
the browser displayed them within actual fortress terrain at Z 128. No new
texture warnings were recorded after the loading fix. This is a short smoke
test; sustained motion, creature disappearance during play and game-FPS impact
have not been measured. Next: layered dwarf graphics and authoritative mod order.

## Dwarf clothing and equipment — 29 October 2026

Added partial definition-driven dwarf layer selection and runtime canvas
compositing. Live inventory IDs are resolved through GetItemList; attachments
use caste body part tokens/categories. Skin palettes, worn clothing, standard
armour, held equipment, item suppression and artifact variants are supported
where their conditions are understood. Large equipment images anchor to the
normal body tile and retain correct pixel-to-world scale.

Live samples initially selected 20–21 layers per dwarf; adding the default face
variant selected 21 for Atír Craftsorder (unit 6715), including a large held-item
layer. An enlarged read-only snapshot preview was rendered and inspected in the
browser; it was an actual appearance snapshot displayed at a centred diagnostic
position, not a live movement test. No compositor console errors were observed.
The temporary preview and snapshot script are excluded from the final changes.

Remaining approximations: face variant one, no hair/beard rendering, incomplete
material/profession palettes, no wounds/syndromes/procedural items and unresolved
active mod precedence. Normal material/dye tint is approximate. Equipment removal
is tested synthetically; no gameplay inventory commands were issued.

Verification: 39 automated tests pass, including body/caste and life stages,
clothing attachments, held-item hand selection, large-image extent, artifact
variants, default face selection, palette remapping, alpha preservation and unsafe
palette IDs. Strict type checking, production build and formatting checks pass.

Final live viewport snapshot: 50 creatures, including 12 dwarves using 21 layers
each. No game inventory was modified for verification.

## Hair and beards — 29 October 2026

Added live hair/beard colour, grooming, length and curl matching against local
vanilla layer rules. Supported styles include unkempt, neatly combed, braided,
double-braided and ponytails; shaved and covered hair is suppressed. Unit
appearance modifiers are mapped through the caste expanded indices. Hair and
beard data are independent. Age colour transitions are approximated by palette
group; individual roots/strands, independent moustache/sideburn shapes and exact
face variants remain unsupported.

Actual samples: unit 1233 had black double braids (length 117); unit 6715 had
chocolate neatly-combed hair (141) and braided beard (262); unit 6717 had a
chestnut ponytail (255). These resolved to 22, 23 and 22 layers respectively.
The browser displayed enlarged actual snapshots with no errors or warnings.
Long ponytail alignment was checked and corrected against the normal body tile.
No hairstyles or inventory were changed in DF for testing.

48 tests pass, including all five visible styles, clean shaving, length boundaries,
headwear suppression, beard/scalp independence, exact curl-index mapping, age
colour selection, missing data and large curly-image swaps. Strict TypeScript
checking and production build pass. The temporary diagnostic snapshot page and
script are removed before commit.

## Facial features � 29 October 2026

Added four stable native face variants per caste and eye pixels driven by each
dwarf's live IRIS_EYE RGB. RFR omits the random face-art index, so the unit-ID
variant is explicitly an artistic substitute; exact nose, mouth and eye
proportions remain unimplemented. Eye extraction uses body-part-linked colour
modifiers and the iris entry, not sclera or pupil entries. No guessed colours.
The source mask is restricted to vanilla adult/child face layers and preserves
skin palette, alpha, outlines and later hair/headwear occlusion.

Read-only live verification found 15 dwarf appearance records. Enlarged previews
confirmed distinct faces, copper/gold/amethyst iris colours and hair/beard layering.
55 tests cover metadata selection, missing/invalid colours, stable variants,
face-only tinting, wire validation and pixel preservation, alongside prior terrain
and sprite checks. Production build passes with the existing Three.js size warning.
