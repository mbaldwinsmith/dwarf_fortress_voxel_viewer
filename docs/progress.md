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

## Buildings, furniture and plants � 29 October 2026

Added read-only building footprints/types and live plant species/positions.
Workshops, furnaces and supported furniture use ground quads; native workshop
machinery overlays are included. Doors stand vertically and switch between
exported open/closed artwork. Species shrubs and saplings billboard toward the
camera, while mature trees retain terrain meshes. Visibility filtering occurs
before transmission, each block owns its object tiles, and empty replacements
remove old objects. Plant reads are cached for five seconds.

Live verification: loaded 6,739 vanilla scenery mappings from 69 local sheets.
Two actual Z128 blocks at X32�63/Y128�143 contained 86 object tiles, all with art,
including kitchens, stills, mason/fishery/craft workshops, beds, tables, chairs
and doors. Surface samples rendered dimple cups, quarry bushes and fungiwood
saplings; a lower sample contained a plump helmet. Browser preview showed native
placements with workshop overlays, vertical doors and vegetation; no console
errors. The preview is an actual read-only snapshot, not invented placements.

63 offline tests cover hidden masking, footprint clipping, partial records,
workshop overlay coordinates, door states, plant species/dead/sapling selection,
geometry orientation, wire limits, deletion, plant cache expiry, camera following
and resource disposal. Strict TypeScript and production builds pass. No gameplay,
save, installation or DFHack configuration changes. Limits include approximate
material/default variants, construction stages, ambiguous door axes and seasons.

## Missing yak and fungal-tree sprites � 29 October 2026

Fixed layered yak body loading, including the separate calf sprite. Read-only
live verification found yaks 6769 and 6770 at X23/Y124/Z128 and X21/Y117/Z128;
both now resolve the native CREATURES_DOMESTIC row 21 body sprite.

Young fungiwood and other visible saplings now resolve from per-tile plant
materials as well as position records. Added species TREE_TILE mappings and
revealed tile billboard rendering for tree trunks and mushroom caps. A live
fungiwood sapling at X9/Y9/Z128 and tower-cap tiles including X29/Y24/Z128 resolve
their local artwork. Root-only filtering no longer excludes mature tree art.
Unmapped tree tiles retain their voxel fallback; hidden tiles remain redacted.

67 tests pass, including adult/calf choice, unsafe-layer rejection, species
material lookup without root records, duplicate suppression, native token naming,
hidden metadata redaction, and removal of occluding cubes only when art exists.
Strict TypeScript and production build pass.

## Wall and floor textures � 29 October 2026

Added native vanilla environment PNG mappings for exposed terrain surfaces.
Rough/smooth stone, soil, grass, ice and constructed wood choose texture families.
Wall sides, cutaway tops and floor faces use UVs in one padded browser atlas;
hidden terrain remains opaque and flat. Terrain geometry and face counts are
unchanged. Native optional BMP variants are skipped safely.

Read-only live preview sampled four fortress blocks at Z128: 993 textured tiles
using six distinct rectangles, with existing workshop/furniture sprites intact.
Browser preview reported no warnings/errors. All 71 tests pass, including family
selection, hidden metadata rejection, unavailable-art fallback, UV counts without
geometry changes and atlas bounds/gutters. Strict TypeScript and production build
pass. Mineral-specific palettes, exact wall adjacency and engravings remain
approximate; no installed assets are edited or copied into the repository.

## Actual material colours and cavern grass � 29 October 2026

Added material-name/RGB caching and per-tile tinting from actual static material
pairs, with construction material taking precedence over underlying geology.
RGB is converted from sRGB to linear vertex colour. Tile inspection reports
material names; absent metadata retains fallback colours and hidden data stays
redacted. Wooden construction walls use their native wall family.

Parsed GRASS_1�4 for species artwork, including native cavern floor fungus, cave
moss and underlichen. Grass species comes from the native static plant material,
verified against pinned DFHack MapCache.cpp. Authored grass colours are preserved
without a second plant-material tint; side faces use underlying layer colours.
Ramp top surfaces also use grass art. Grass density fading/edge transitions
remain approximate.

Live read-only snapshots of four Z128 blocks contained 994 coloured tiles and
18 native floor-fungus grass tiles. Materials included mica, schist, granite,
gabbro, sphalerite, native silver/gold and microcline. Browser preview had no
console warnings/errors. No constructed terrain was present in these samples;
construction precedence/wood tinting is covered by regression tests and native
static-material semantics. All 76 tests and production build pass.

## Textured wall caps and enclosed-ore masking � 29 October 2026

Wall tops now use the game's dark hidden-rock textures rather than full material
textures or a flat fill. Five coordinate-stable variants remain independent of
the underlying ore. Exposed material colours remain on side faces. Generic cap
art is permitted on unknown/fully enclosed cells without disclosing their data.

Enclosed natural wall payloads now contain generic solid rock only; material
colour/name, ore class and finish are stripped before the browser receives them.
Only confirmed-open revealed neighbours qualify as exposure, including diagonal corners. Unknown
and unloaded neighbours fail closed, including native omitted blocks. A bounded
openness cache permits cross-block edge recovery during later terrain sweeps.
Construction and tree handling are preserved.

A live two-block top-down snapshot redacted 61 enclosed walls with zero material-name,
colour or material-texture leaks. All 88 tests pass, including full ore metadata
redaction, missing/unknown neighbours, subsequent boundary exposure, native
ore-independent cap variants, shader UV/tint selection and payload validation.
Strict TypeScript and production build pass; native game assets remain read-only.

The final cap implementation includes the native neighbour-aware wall border
art, not just hidden-rock fill. N/S/W/E edges and diagonal-only corners resolve
from all eight adjacent tiles, with material/finish-specific directional families.
Transparent alpha-tested rim quads reveal the dark base through their holes.
A top-down live snapshot verifies the game-style outline pattern directly.
The final suite has 88 tests covering edge/corner token selection, chunk-corner
exposure, material families and transparent rim sampling as well as anti-spoiler
masking. The two-block directional sample masks 61 enclosed walls with zero
material metadata leaks.

## Independent texture critic iterations � 29 October 2026

An explicitly requested read-only critic compared the user's 891x555 DF screenshot
with the same live fortress area rendered from above. The fixed rubric covered
floors (35%), cap/mineral edges (30%), cavern ground (15%), furniture/workshops
(15%) and pixel/palette consistency (5%). Scores progressed 2.295 -> 4.055 ->
4.53/5, meeting the requested 4.5 threshold without changing weights.

Corrected double-tinted natural floors and lighting, restored native charcoal
interiors, distinguished ore/gem/ordinary-mineral edge families, used native
grass variants and stair sprites, tinted workshop bases separately from their
overlays, and added native bed sheet/pillow detail layers. Bed graphic seeds
remain absent from RFR, so styles are stable approximations. Loose items, moved
units and upright doors seen edge-on are separate coverage/geometry differences.
The final rated image is a genuine read-only live snapshot, not a screenshot
composite or reference pixels inserted into the viewer.

Final validation: all 93 tests, strict TypeScript, production build and formatting checks pass. The existing Three.js bundle-size advisory remains.

## Loose items and furniture colours - 29 October 2026

Decode MapBlock.items and Item.pos/stack_size/projectile from the pinned native
schema. Ground objects share the existing batched scenery renderer and asset
allowlist. Filter explicit on_ground plus inventory/container, removed, building,
construction, encased, garbage_collect and interface-hidden flags; reject off-block,
wrong-Z, hidden terrain and projectiles. Reserve at most one supported sprite per
tile, chosen by stable item ID, with no stale item cache. Item stacks remain one
sprite; unsupported art is omitted. Live pickup removal is not game-mutated for QA.

Load material-specific boulder/gem/bar mappings and the installed default descriptor
palette. Match inorganic solid STATE_COLOR to native palette rows and perform exact
source-colour replacement in cached scenery sheets (bounded to 512 materials).
Use these palettes for boulders and installed tables/thrones; keep terrain palette
behaviour unchanged. Schist now uses DARK_CHESTNUT, orthoclase CHESTNUT. Current
furniture variants remain approximate because RFR does not supply graphic seeds.

Verified 53 loose item sprites in the live area, with actual material palette rows;
inspected a genuine snapshot through the WebGL renderer. Added regression coverage
for flag exclusions, coordinate/redaction boundaries, stack/duplicate stability,
pickup/removal snapshots, native wire fields, overrides and furniture palettes.

## First-person navigation - 29 October 2026

The viewer has Orbit / camera-point selection / first-person states. Selecting
1st person uses the whole-map stream; hovering terrain displays a pulsing green
floor selector (red for blocked or unloaded locations). A valid click saves the
orbit camera, disables OrbitControls, places the eye 0.64 tiles above the floor,
and requests pointer lock in that user gesture. WASD uses normalized horizontal
motion, clamped frame time, small collision steps and axis sliding. Mouse motion
uses yaw/pitch with pitch clamping. Escape, blur and pointer-lock changes clear
held keys; Escape releases capture, clicking resumes, and exiting restores orbit.

Walking tests the player footprint against revealed floor/ramp/stair tiles and
loaded overhead data, including adjacent block seams. Missing/unknown ground is
blocked. The map's topmost level requires no overhead block. Low roof clearance
blocks movement onto ramps. Walking stays on the chosen Z; there is no gravity,
inter-level stair travel or furniture/door collision in this implementation.

blockOrder now loads each XY block with the overhead block immediately after it,
then two lower levels, within the existing 4096-block resident bound. Orbit mode
still omits all above-cut geometry. In first person, the layer above emits only
underside ceiling faces over open ground. Unknown/enclosed roof rock uses neutral
colour and artwork from the revealed floor, avoiding hidden material disclosure.
All ceiling meshes use the existing neighbour invalidation and disposal path.

Verification: 101 regression tests cover boundaries, roof winding and mode gating,
headroom, hidden/unloaded collision, chunk seams and streaming order/top bounds.
A browser integration check against an 18-chunk live snapshot verified glowing
selection, click-to-spawn, pointer capture, WASD displacement, mouse look, Escape
pause, recapture, and return to selection, with no page errors. Screenshots show
actual ceiling geometry and installed textures. Production build and formatter
checks pass; the existing Three.js bundle-size advisory remains.

## Stair/ramp travel and embedded-browser controls - 29 October 2026

Click capture now explicitly focuses the canvas and enables a fallback input mode
when pointer lock is denied/unavailable. WASD works while the view has focus; free
mouse look uses successive client coordinates while hovering the view, avoiding
large jumps when entering from toolbar controls. Escape and focus loss pause and
clear held keys. The banner reports capture/fallback/paused state; failures no
longer silently disable all input.

Ramp foot heights sample the exact four-triangle terrain surface. Movement may
cross a one-level boundary only via a ramp and a nearby-height revealed landing;
footprint checks span both levels. Connected stair columns require up/down support
at both ends: W ascends, S descends, with a half-second interpolated step. Unknown,
unloaded, disconnected and low-clearance destinations remain blocked.

The stream spans cut +/-2, pairs local blocks with both overhead layers, and
accepts bounded optional camera XY coordinates on the existing read-only level
request to prioritize the walking neighbourhood. The 4096-block cap is unchanged.
The cut follows camera height while climbing. Completed level changes request new
terrain and pause further travel until the matching reset; that expected reset
preserves first-person camera/input, while other resets still exit safely.

Regression tests cover ramp sampling/ascent/descent, ledges, stair direction
matching and hidden destinations, focus ordering and map bounds. Browser fixtures
with pointer lock deliberately rejected verify focused WASD, mouse look, both
stair directions, ramp ascent/descent, Escape and recapture. A renderer fixture
verifies that a simulated level/terrain reset preserves active walking. The local
dev server was restarted after the user's connection interruption; DFHack port
5000 was unavailable afterward, so fresh live-game traversal remains unverified.

## Live navigation verification - 29 October 2026

Fresh read-only live testing now supersedes the earlier disconnected-game limit.
The production viewer handlers passed stairs up/down at X34/Y128 (Z128/129),
WASD, mouse look, Escape and recapture against the loaded fortress. A denied
pointer-lock run also passed actual-terrain controls and ramp ascent/descent from
the lower floor at X28/Y120/Z128 through X29/Y120 to X30/Y120/Z129 and back.
No browser page errors occurred. See live-navigation-check.md for the test scope.

Fixed delayed lower-column loading, unintended horizontal movement while stair
connection data was missing, and a three-sided ramp whose low edge was raised by
side walls. Confirmed upper landings now select uphill supports, and updates also
invalidate all horizontally adjacent chunks one level below for seam correctness.

The user's upward-visibility report exposed a remaining orbit cutaway in first
person. Full loaded geometry now renders through cut+2 instead of replacing the
upper layer with ceiling-only faces. Stair slabs and flat top sprites are replaced
by narrow 3D treads with an open centre in first person; orbit art is unchanged.
Objects/creatures use the full loaded vertical range, and view-height changes
replace meshes gradually instead of clearing them all. Ceiling fallback artwork
still uses revealed lower-tile stone art for sealed/unknown rock.

A fresh live view ray from eye height 128.76 hit the actual Z129 wall at height
129.4267 through the staircase, then live stair/ramp/input checks passed again.
Final validation: 109 tests, strict TypeScript, production build and formatter.

## Packaged Windows app - 29 October 2026

Added an Electron desktop launcher and electron-builder installer/ZIP targets.
The app starts the read-only companion on an OS-assigned loopback port, discovers
or remembers a DF installation, supplies packaged UI paths independent of working
directory, and terminates its child when closing. File-menu controls change the
installation or restart the companion. Native game files remain read-only.

The renderer has sandboxing, context isolation and no Node integration. Navigation,
new windows and permissions are restricted to the app's private companion origin;
pointer lock is the sole granted permission. The desktop server sends a CSP. The
packaging allowlist excludes machine configuration, game assets, saves and ignored
reference files. Archive inspection found 177 entries and only the original app
icon as PNG artwork; the unused Three.js runtime dependency is excluded.

Node 22.12+ is required for building (tested with bundled Node 24). Commands:
npm run desktop, npm run pack:win, npm run dist:win, npm run desktop:smoke.
Windows app workflow supports manual build artifacts and matching v-version tags
that produce draft GitHub Releases, with checksums and a packaged executable smoke
check. No tag/release was published as part of setup. Packages are currently unsigned.

Validation: all 111 tests, strict TypeScript/build, formatting and zero npm audit
findings. Both installer and portable ZIP targets built locally. The actual ASAR
packaged executable passed startup/WebGL/no-Node-exposure checks and connected to
its bundled companion at an ephemeral port. An isolated smoke profile also passed.
The CI-only smoke path permits software WebGL on GPU-less runners.

## Surface ramp downhill edges (0.1.1)

Diagonal uphill neighbours no longer raise a ramp corner beside a revealed lower
floor unless a cardinal uphill wall also supports that corner. This keeps the
visible mesh and walking height aligned and removes the artificial lip that
blocked descent onto surface grass. Hidden terrain still supplies no walkable
exit, and wall, headroom and unloaded-terrain collision checks are unchanged.

Regression tests walk fully down and back up the hillside in all four cardinal
directions, with diagonal uphill corners on both sides of the lower exit.
Read-only terrain checks against the running fortress also verified descent at
X54/Y67 from Z174 onto the lower grass at Z173. These checks sample the actual
navigation/collision functions against DFHack terrain, without moving game units.

## Streaming continuity and ramp crest seam

View changes now use an incremental message within the same world session. Both
ends retain overlapping chunks within the five-level window and evict only the
departing levels/columns. True world changes still invalidate the entire session.
Overlapping meshes and scenery remain in place. First-person walking no longer
waits for a remote reset after every Z transition; unloaded terrain continues to
block movement through the existing collision checks. The cut follows the support
level, rather than oscillating when eye height crosses an integer Z on a slope.

Missing blocks load before cached refreshes, with the polling delay applied per
16-block batch instead of per block. World checks bracket each bounded batch.
Idle preview reloads reuse the companion's warm connection/cache without polling
the game while there are no clients. Mesh rebuilding skips absent/invisible keys
without consuming its per-frame work allowance; unused normal computation is
removed from the unlit terrain material.

Ramp crests now reach Z+1.12, exactly matching the upper floor slab. Rendering and
navigation share that height, removing the 0.12-tile vertical lip.

Validation: 118 tests and production TypeScript/Vite build passed. Live browser
checks against the fortress loaded 100 chunks in 3.013 seconds (the previous
per-block sleeps alone required 20 seconds). Z acknowledgements took 54–130 ms;
the first check preserved all 52 existing meshes. A live WASD crossing at X54/Y67
descended from Z174 onto Z173 grass and returned to Z174, with controls active,
no terrain-wait flag and no page errors. These are loading/navigation timings,
not an FPS benchmark. Installer builds were not run.

## Environment rendering

Implemented fractional water/magma, real 3D tree volumes and animated native flow
sprites, in that order. Water follows the user's subsequent preference for native
DF textures and translucency instead of procedural shaders. Root ground and
creature/water depth ordering are corrected. See environment-rendering-review.md
for critic scores, exact scope and validation limitations. All new artwork is
loaded from the user's installed game; no game sheets are copied into the repo.

## Unified navigation controls

Left-drag pans along the map plane and right-drag rotates in Orbit and DF Screen
views. A drag does not trigger tile inspection or select a first-person spawn;
a plain click still does. Shift+comma (`<`) moves up and Shift+period (`>`) moves
down in Orbit, DF Screen and spawn-selection views, with map-bound clamping.
In first person those same keys climb connected stairs; WASD only walks/strifes
and continues to follow ramps automatically. Unloaded or blocked stair destinations
remain inaccessible.

DF Screen keeps following the game's XY viewport while permitting a viewer-only
Z override. A change to the game's own viewed Z resumes native elevation following;
switching modes also clears the override. No game camera or gameplay RPC is sent.

Validation: browser gestures verified both modes, drag-versus-click selection,
all shifted level shortcuts and stair ascent/descent using controlled map data.
The 141-test suite includes shortcut decoding, unloaded stairs, WASD on stairs
and DF Screen elevation-override behaviour. The dev preview remains the test target;
no installer build was run.

## Sixteen-level rendering window

The shared loading/retention window now covers the current level, five below and
ten above across the full requested footprint. This replaces the separate local
canopy extension. Terrain, liquids, scenery, flow effects and creature queries
use the same bounds. First person shows the upper levels; Orbit retains its
selected cutaway. Map limits clip the window and nearby columns still load first.
Tests verify all 2304 unique blocks for a 192×192 footprint, map-edge clipping,
overlap retention, focus ordering and creature visibility at both range limits.
All 142 tests pass. No installer build was run.

## Column streaming and frequent moving-object updates

Native terrain requests now batch up to sixteen z-levels in one bounded column,
with world identity checks before and after each read. The surrounding 3x3
columns at the walking level and two levels either side load first. The full
192x192 footprint still receives all 2304 blocks, using 153 column requests
instead of 2304 individual requests. RFR's first-block building list is shared
across the returned column and filtered by each chunk's revealed tiles.

The bridge retains a bounded 4096-entry cache including inactive fringe levels,
restores recently departed terrain without a native round trip, and skips fresh
terrain reads (2 s near the selected level, 10 s farther away). Level/focus
changes interrupt streaming throttle waits. The viewer preserves overlapping
meshes, skips rebuilding known pure-air chunks and ignores obsolete walking
view acknowledgements. Stair input remains queued while landing headroom loads.

Creatures target 250 ms snapshots of the loaded window. Ground items within the
nearest 3x3 columns and three z-levels target 1 s partial-block polls, including
removal/pickup, independently of terrain freshness. Distant items update with
their terrain columns. Item-only changes update scenery without rebuilding
terrain meshes, and item polls never extend terrain freshness. The connection
remains single-flight and read-only; these are polling targets, not guarantees.

Live validation on the loaded fortress: three sixteen-block comparisons measured
individual reads at 338/306/309 ms versus column reads at 50/30/32 ms (6.8-10x
for native terrain reads, not an end-to-end frame-rate claim). Browser checks
preserved overlapping meshes and the world session across a view change, climbed
three real stair levels and returned, and traversed a real ramp down and back up.
No page errors or terrain-wait stalls occurred in the completed traversal check.
Creature snapshots usually arrived 0.3-0.5 s apart during that loading test, with
occasional longer gaps. The development preview is the test target; no installer
build was run.

Final validation: all 150 tests, TypeScript/Vite/bridge build and repository
format checks pass. The final compiled-bridge traversal run observed creature
snapshots 267-469 ms apart and no page errors.

## Wall and fungi surface cleanup

Intersecting trunk and branch boxes now emit only their exposed surfaces, with
clipped UVs preserving the original texture scale. Coplanar duplicate faces and
hidden interior faces no longer compete in the depth buffer. Cutout leaves do
not remove opaque bark behind their transparent pixels. Wall-rim overlays use
distinct depth layers, and the first-person camera clips to the map footprint
instead of a 4000-tile distance to improve depth precision.

Sealed and unknown ceiling undersides fall back to the installed neutral stone
floor texture when there is no revealed floor artwork below. This per-chunk
reference is constant and independent of hidden ore/material data. Dark wall
caps and discovery masking remain intact. A controlled underside view using
native fungiwood and stone artwork verifies textured ceilings and clean branch
joins without browser errors.

## Creature sprite coverage

Camel sprites were missing because layered body extraction was restricted to
yaks. It now handles the shared body rules across pack animals, and large-image
parsing covers large/giant animals and megabeasts. Living animation frames supply
static fallbacks for template-based animal people and trolls. Native child
variants, caste lookup and large sprite scale are preserved. The installed
profile increased from 204 to 1028 artwork keys; both live two-humped camels and
all 20 creatures in the loaded window now have sprite/layer artwork.

The audit and remaining layered-humanoid limitations are documented in
[creature-rendering.md](creature-rendering.md). A controlled WebGL lineup of
eleven native animals loaded successfully with no browser errors. No installer
build was run.

## Shared humanoid layering

The living layer evaluator now supports all 203 compatible native race/caste
profiles (198 species), including template-based animal and underground people.
Native arguments, permitted limbs, pixel offsets and large weapon rectangles
expand into a common ordered compositor. Clothing, armour, held weapons,
shields, tools and native hauled-supply layers use live anatomy/inventory for
every supported species. Material, profession, ghost, body-size and life-stage
rules use the matching read-only RFR fields; unknown conditions stay closed.

The appearance cache now retains active composites and releases old equipment
variants, with capacity for the protocol's 2000-unit limit. Offset-aware bounds
prevent cropped weapons and displaced body anchors. The native profile audit
produced composites for all compatible sets, and a 24-composite bare/equipped
WebGL lineup loaded without errors or sprite warnings. The live fortress retained
artwork for all 20 visible creatures. See creature-rendering.md for fidelity
limits, including unavailable native random-part indices and syndrome classes.
