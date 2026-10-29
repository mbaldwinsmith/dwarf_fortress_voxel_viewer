# Architecture

`src/bridge` owns the local HTTP/WebSocket server, DFHack TCP connection,
protobuf subset and RemoteFortressReader adapter. `src/shared` defines validated
viewer messages, tiles and session state. `src/viewer` contains the Three.js scene,
mesh builder, connection and HTML controls. No framework or external services.

## Data flow

The bridge opens one loopback TCP connection only while viewers are connected.
It sends the 12-byte DFHack v1 handshake, binds a fixed allowlist of twelve reader
methods using their exact protobuf type names, then issues sequential calls.
The native 8-byte message header has a signed 16-bit ID, two padding bytes and
a signed 32-bit size, little endian. FAIL carries its error code in the size
field and has no body. TEXT replies are consumed until RESULT/FAIL. Timeouts
destroy the connection; late replies cannot be reused for another request.

Only DF 53.16 / DFHack 53.16-r3 / RFR 0.21.0 is currently accepted. These were
verified live and against DFHack commit `0bf381cc`. Other versions display an
unsupported-version error until their definitions and semantics are checked.

### Polling and cache semantics

RFR `GetBlockList` normally returns partial fields, uses plugin-global hashes,
and may omit all-air blocks. `blocks_needed` counts terrain blocks, not every
response record. It is not a complete snapshot or a push API.

We request exactly one 16 × 16 × 1 block with `force_reload=true`, including
terrain and designations. A missing block replaces the old block with air;
missing visibility on a returned block is an error, never interpreted as visible.
No global cache reset, commands, suspend, pause or gameplay calls are used.

The full XY map footprint is streamed at the selected Z and two levels below.
The slider spans the map's entire Z range, initially using DF's viewport Z.
Requests visit the selected layer first, centre outward, then the lower layers.
At most 4096 blocks can be resident; larger footprints are rejected explicitly.
Polling sleeps at least 100 ms between blocks (200 ms default), with one RPC in
flight. Changing Z cancels the old scan after its current RPC and resets the
session/cache. All clients share the latest requested cutaway. Frame timing
is independent of polling. Camera X/Y and viewing angle survive level changes.

Late join snapshots stream as individual chunks with bounded socket buffering,
reading the latest cached block at send time. Replays stop on session changes.
Incoming WebSocket operations accept only a validated integer level within the
loaded map bounds; no gameplay operation is available.

Map identity (save, world, embark position and size) is checked before and after
each block. Map errors, TCP reconnects and identity changes clear state and create
a UUID session. Each browser receives a reset, cached snapshot and per-client
monotonic chunk sequence; mismatches reload and resynchronise. A same-save unload
and reload entirely between two observations cannot be distinguished by this
API; full forced block refreshes still replace the bounded region.

## Coordinate and mesh conventions

DF coordinates remain absolute integer tile X east, Y south, Z up. Chunk X/Y
are tile origins, multiples of 16; Z is one tile level. Tile index is `y*16+x`,
verified against `CopyBlock` and `CopyDesignation`. Request X/Y are **block**
coordinates, with exclusive upper bounds; response X/Y are **tile** coordinates.
Three.js uses `(dfX, dfZ, dfY)` with positive Y up; the north arrow is a fixed
world-axis guide, not a camera-relative compass.

One mesh per native block contains exposed surfaces. Adjacent full walls suppress
faces across block boundaries. Updates dirty the block and eight horizontal neighbours and two vertical neighbours.
Floors are 0.12 tile thick. Stairs use original steps; ramps derive corner heights from adjacent cardinal and diagonal walls, rising
toward each supporting edge/corner. Multiple exits use a triangulated basin;
unsupported ramps remain flat at floor height. This is visual geometry, not a
claim that the ramp is pathable (upper-level clearance is not tested). Cutaways omit blocks above the selected Z,
exposing opaque top caps on remaining walls. Hidden tiles are opaque neutral
cubes; their actual shape, material and name are removed in the bridge.

Meshing is bounded to three chunks / approximately 8 ms per animation frame
(one chunk may exceed that time). GPU buffers are disposed on replacement and
reset. Rendering and camera updates run independently of polling. Routine updates
preserve the camera. Frame/reset deliberately repositions it.

## Local boundaries and assets

HTTP binds only to 127.0.0.1; WebSocket upgrades require a local viewer origin and
the exact `/live` route. Incoming WebSocket messages accept only bounded cutaway selection; there is no
DFHack proxy. HTTP serves index.html, registered local atlas IDs, and flat generated asset identifiers
under the built viewer directory; no arbitrary filesystem route exists.

`DF_PATH` is optional machine-local configuration. The installation inspector
reads module `info.txt` metadata and remote port configuration without writing.
Available modules are not assumed to be the active world's ordered modules.

Installation inspection found vanilla graphics modules in `data/vanilla`, an
empty installation `save` directory, and actual saves under the Windows user
profile's `AppData/Roaming/Bay 12 Games/Dwarf Fortress/save`. Save files are not
parsed, modified, copied or committed. Current RFR reader messages do not expose
active mod order. A future graphics resolver needs an authoritative world mod
manifest before resolving ordered overrides; scanning directories is insufficient.
Creature rendering now uses an explicitly labelled vanilla fallback profile; it
does not infer active mod precedence. Unsupported layered graphics remain markers.

## Source provenance

The small protobuf schema is an independently written, read-only field subset
of the [matching upstream schema](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/proto/RemoteFortressReader.proto).
Message layouts and polling semantics were checked against
[RemoteClient.h](https://github.com/DFHack/dfhack/blob/0bf381cc/library/include/RemoteClient.h),
[CoreProtocol.proto](https://github.com/DFHack/dfhack/blob/0bf381cc/library/proto/CoreProtocol.proto)
and [the plugin implementation](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/remotefortressreader.cpp).
No upstream implementation or game assets are redistributed. Runtime dependencies
retain their own licences in their packages; project code uses the repository MIT licence.

## Render-view selection

The validated `mode` operation accepts only `screen` or `map`. Screen mode
reads GetViewInfo and rounds the viewport out to native block boundaries, clipped
to the local map. Its Z follows DF and its viewport is checked every twelve block
reads. Map mode keeps manual Z selection. Mode/region/Z changes reset the session
and dispose the previous terrain. Radio controls are synchronised by reset
messages across clients. Camera framing follows screen panning without changing
the viewing angle. Neither operation changes the game.

## Creature billboards

GetUnitListInside is polled between terrain calls, at most once per second;
requests remain sequential. The installed implementation emits partial records
for out-of-region units, so positions and flags are validated independently.
Inactive, off-map, incoming, ambushing and caged units are filtered, as are units
on unstreamed or undiscovered tiles. GetPartialCreatureRaws resolves at most eight
new race indices per poll, with one raw record per call. Unit snapshots are capped
at 2,000, session-scoped, monotonically ticked and replace the previous unit list.
They never rebuild terrain.

The explicit vanilla profile parses TILE_PAGE and simple DEFAULT:...:AS_IS
creature/caste definitions from the configured installation. Simple definitions use atlas rectangles; dwarf layer support is described below. Conflicting page/creature definitions
fall back to markers. This installation yielded 202 simple mappings in four sheets.
Resolved images must remain within the graphics root after realpath validation.
The local-art route accepts only hashed identifiers registered by the parser; no
client paths are accepted. No images are copied into the repo or build output.

Three.js Sprites provide camera-facing quads with nearest filtering, atlas UVs,
alpha-tested transparency and terrain depth testing. Loading failures use original
diamond markers. Material/texture caches are bounded (256 sprite variants) and
disposed on viewer teardown. Scene/session resets remove old creature objects.

Unit flag positions were checked against the matching df-structures revision
[d8ff8a63](https://github.com/DFHack/df-structures/blob/d8ff8a6326db37c11dc4173fadcf30b56e51b42d/df.unit.xml).

## Partial layered dwarves

GetItemList maps live item type/subtype pairs to definition IDs. GetMaterialList
provides material colours once per connection. Unit snapshots now read appearance
colours and inventory item mode, type, material, dye, flags and attached body part.
Caste raws supply body tokens/categories and skin-pattern IDs. Only worn and held
items are considered; hauled inventory does not become worn equipment.

The explicit vanilla dwarf definition is parsed into life-stage sets and ordered
layer groups. The first supported matching layer in each group is selected.
Supported rules include caste, skin palette, worn/held item subtype and attached
body category/token, item suppression and artifact flags (item_flags bits 18/27
from matching df-structures). Other material/syndrome/wound/procedural rules fail
closed. A stable unit-ID hash selects one of four native face variants because RFR
does not expose the game random-part index. Hair/beard rules are described below.

The browser composites selected local PNG rectangles onto an in-memory canvas.
Large-image rectangles anchor at the bottom-right normal tile; world scale remains
32 pixels per 1.2 tiles. Exact skin palette colours are remapped from the declared
default row. Item colours use approximate shaded material/dye tint, not the full
DF material/profession palette algorithm. Composites are GPU textures with a
256-appearance limit and are never written to disk or included in build output.
Inventory changes alter the composition key; snapshots replace the material on
the existing billboard. Unsupported or failed composites retain markers.

## Hair and beard matching

UnitAppearance now reads separate scalp and beard lengths and style enums, with
bp_modifiers and appearance colours. Caste tissue layers reference expanded
modifier slots; modifier_idx maps those slots to modifier definitions. CURLY
values must use the expanded unit slot, not the modifier-definition index.
Colour modifier body-part/tissue-layer pairs select the relevant pattern.
Age-gated modifiers use DF days (336 per year); the latest started modifier
selects the palette group. This approximates gradual root greying, not individual
strands. Missing colours/styles are not guessed.

Supported graphics rules: inclusive length limits, unkempt, neatly combed, braids,
double braids, ponytails, clean shaving, colour groups and IF_MIN_CURLY image
swaps (including large images). Headwear/cloak suppression uses existing live
inventory conditions. Scalp hair and chin-whisker/beard styling are independent.
Separate moustache/sideburn rules and exact random face variants remain outside
this subset. Normal tile anchoring is preserved for tall hair images, avoiding
floating ponytails and changing character scale.

## Facial features

Adult and child faces now use the four vanilla nose/mouth/eye-layout variants
per caste. A unit-ID hash selects a stable artistic variant; this is not the
game's random-part index and does not reconstruct actual facial proportions.
Caste colour modifiers are matched to EYE body parts, then indexed by live
UnitAppearance.colors. PatternDescriptor field 2 supplies RGB colours; native
IRIS_EYE patterns order sclera, pupil, iris, so index 2 is the iris colour.
Missing or malformed eye metadata leaves the original art unchanged.

Only inspected vanilla face rows (DWARF_BODY rows 0 and 3, columns 0�7, with
a HEAD random-part condition) receive eye colour metadata. The compositor masks
opaque pure-black source pixels, which are the two pupil pixels in these faces.
It paints a 70% iris/black mix after skin palette remapping, preserving the
charcoal outline, white sclera, skin and alpha. At 32-pixel character scale this
is a pupil/iris approximation. Later hair, beard and headwear layers naturally
occlude the face. Eye colour participates in the existing composition cache
key; RGB is validated before browser use. No installed assets are modified.

## Buildings, furniture and vegetation

The restricted protocol now decodes MapBlock.buildings (field 19) plus
GetBuildingDefList, GetPlantRaws and GetPlantList. Building type/subtype/custom
triples resolve against definitions from the loaded world. CopyBuildings emits
index-only records even outside the requested block: records without complete
footprints are ignored. Actual footprints use inclusive X/Y maxima and the top
Z; room extents are not furniture extents. Stockpiles, zones, constructions and
unsupported large building classes are excluded. Workshops, furnaces, trade depots
and supported furniture generate per-tile objects clipped to the owner block.
Each tile must already be revealed, loaded and non-empty; no object names or
references cross the bridge for hidden tiles. Objects are bounded to 768 per chunk.

The explicit vanilla art profile additionally reads building, item and plant
graphics modules. TILE_GRAPHICS tokens map workshop stage/footprint coordinates;
PLANT_GRAPHICS maps species and shrub/sapling states. PAGE_DIM is in tiles,
PAGE_DIM_PIXELS in pixels. Paths use the existing realpath image allowlist and
opaque asset IDs. Only original installed PNGs are served; assets are not copied
into the repository or build. Conflicting art mappings fail to neutral footprints.

Ground art uses completed workshop mosaics with the extra above-footprint row
omitted. Machinery overlays sit 0.003 tiles above base art to prevent z-fighting.
Furniture uses default local variants, with a coarse inorganic/other stone/wood
choice; exact material palettes, quality, damage and build stages are not reproduced.
Unsupported workshops use an original neutral footprint. Doors use RFR active
(1 closed, 0 open) and stand vertically at tile centres. Nearby walls infer their
axis; ambiguous corridors use an X-aligned plane. RFR does not export door or bed
orientation, so no exact facing is claimed. Beds and furniture remain flat.

GetPlantList internally iterates 3x3-block columns and requires whole tree bounds
in Z. A read-only query aligned outward to these columns covers the bounded local
map and its full height. Results are cached for five seconds, capped at 32,768
positions, and filtered against each revealed terrain block. Species resolve from
live PlantRaw indices. Shrubs/dead shrubs and saplings/dead saplings use matching
art where available, otherwise vanilla generic vegetation. Revealed tree tiles now use the species billboards described below; grass and
growth seasons remain approximate.

Chunk.objects is authoritative, including an empty array after removal. Refreshing
a block replaces all its object geometry, so harvested plants and dismantled
furniture disappear on the subsequent terrain sweep. Renderer rebuilds share the
existing three-block/eight-ms frame budget and neighbour invalidation, allowing
door axes to update when adjacent terrain arrives. Ground and door quads batch
by atlas per block; plants face the camera each frame. Alpha testing, depth testing
and the cutaway apply to all objects. Reset removes objects and disposes geometry;
full disposal also releases atlas textures and materials.

## Yak and fungal-tree visibility correction

Vanilla yak art uses DEFAULT layer sets rather than simple DEFAULT sprites.
Only the default BODY/CBODY layers with a sole NOT_CHILD/CHILD condition are
accepted as yak body references; saddlebag, animated and corpse layers are excluded.
Vanilla YAK CHILD:1 selects calf art below age one, adult art otherwise. Unit
position, discovery and flag filtering remain unchanged.

MapBlock.materials field 5 now provides each tile's plant material species index
(PLANT_1 material range 419�618). Revealed shrubs and saplings resolve species
directly from their tile material, with the position list retained as a fallback.
This avoids depending on plant-root discovery and the five-second position cache.
TREE_TILE graphics are parsed per species. Revealed tree/mushroom material tiles
carry a bounded treeGraphic key derived from the native tile identifier; hidden
tiles never include this metadata. Trunks, branches and cap tiles can now billboard
at their actual loaded X/Y/Z even when the plant root is on a different level.
Cap direction suffixes and numbered floor variants map to the native token form.

A tree voxel is replaced by a thin base only when that exact tile has usable
plant art. Missing mappings keep their voxel fallback. Adjacent stone faces remain
visible next to billboard vegetation. No full tree silhouette or unseen canopy is
invented; the cutaway displays only the revealed tile slices that were streamed.

## Wall and floor textures

The vanilla_environment graphics module supplies TILE_GRAPHICS mappings and
PNG sheets through the existing asset allowlist. Optional BMP pages are skipped,
without aborting other mappings. Permitted file resolution is cached per page,
avoiding repeated realpath work across thousands of tile tokens.

RFR tile special 3/11 marks smooth terrain. Revealed tiles receive validated
surfaces.top and surfaces.side references from coarse material/finish families:
rough or smoothed stone, soil, grass, ice, and plant-material constructed wood.
Four rough-wall variants use a stable world-coordinate hash. Missing artwork
leaves the tile flat. Empty, hidden and tree-billboard tiles get no terrain art;
hidden smooth/texture metadata is rejected by message validation. This does not
reproduce individual mineral palettes, engravings or the game's adjacency art.

TerrainAtlas packs requested 32px rectangles into one 2048px browser canvas,
with 34px cells and extruded gutters. Cell zero is opaque white for the existing
vertex-colour fallback; up to 1,023 additional rectangles are allocated. Transparent
source art is composited onto white, preserving opaque walls. Image dimensions
are checked; failed loads leave flat colour. Asynchronous uploads update the
atlas without rebuilding geometry. Nearest filtering and half-pixel UV insets
avoid neighbouring-cell bleed; mipmaps are disabled.

Each exposed mesh vertex now has UVs. Horizontal faces use top references and
vertical faces use side references, including walls, floor edges and cutaway
caps. Existing ramp/stair geometry receives the same family textures. Face culling,
chunk ownership and vertex counts are unchanged: one MeshBasicMaterial and
one shared atlas retain existing per-block draw calls. The atlas has bounded
allocation, survives world resets and disposes with the renderer.

## Actual terrain material colours and cavern grass

SceneryReader now caches GetMaterialList definitions once per connection, including
material names and RGB state colours. Native MapBlock.materials (field 5) is the
static material, including actual construction material; this takes priority over
base_materials (field 8). Revealed terrain receives RGB and material-name metadata,
with strict 0�255 validation. Missing/invalid RGB preserves the class-colour
fallback. Unknown tiles receive neither colours nor material names. Inspection
shows the resolved material name. The browser converts sRGB material channels
to linear vertex colours before applying the texture compositor where material tinting applies; authored floor colours
are preserved as described in the screenshot-fidelity section below.
These are source RGB tints, not a promise of pixel-identical game lighting.

Pinned DFHack MapCache.cpp confirms grass static material selects the dominant
block grass event's plant basic material. Its index resolves through PlantRaw
to the exact PLANT_GRAPHICS identifier, including spaces in FLOOR FUNGI and CAVE
MOSS. Graphics parsing now supports GRASS_1�4; floor fungus, cave moss and
underlichen select native CAVERN_GRASS rows, while surface grasses use their
species art. Four variants are stable by world coordinate. Grass-percent field
29 is decoded, but density fading and CUSTOM_EDGE transitions are not implemented.

Authored grass textures preserve their native colours using a white top tint;
they are not multiplied by the plant structural material RGB. Ground side faces
use layer_materials (field 6) where available and dirt artwork. Plant-covered
tiles also prefer layer colour for their ground tint. Sloping ramp tops now
select top artwork/tint instead of wall-side artwork. Constructed plant-material
wood uses the native wooden-wall and wood-floor families with its actual RGB.
Only the revealed tile metadata crosses the bridge; no raw hidden material or
grass identifiers are exposed.

## Spoiler-safe textured wall caps

Wall top faces now use native HIDDEN_ROCK_1�5 PNG rectangles, including
undiscovered cells. A stable coordinate hash chooses the variant independently
of tile material, mineral, colour, smoothness or ore. A neutral 0.45 linear tint
keeps authored cap textures dark under the viewer's lighting; native flecks remain
visible. Enclosed cap UVs never sample material/ore artwork; directional rims
use only the material of confirmed exposed edges. Missing cap art uses uniform
dark colour. Exposed side faces retain their normal material texture and tint.
The base cap reuses its existing face. Directional rims add quads without adding
terrain material draw calls.

The bridge also masks enclosed natural walls before decoration/transmission.
Only one of the eight neighbours confirmed open and revealed exposes wall material.
Enclosed walls become {shape:wall, material:2, name:Solid rock, sealed:true};
material names, colours, finish, ore class and texture references are discarded.
Terrain decoration never rehydrates sealed material from raw RFR pairs. A separate
generic wallCap reference is allowed for sealed/unknown cells because its choice
contains no hidden information. Wire validation rejects any sealed material
metadata. Construction walls and tree graphics retain their existing handling.

FortressAdapter keeps only 256-byte openness grids for up to 4,096 read blocks.
Absent or unknown neighbours fail closed; missing RFR blocks never count as
confirmed open for this purpose. Cross-block edge material can appear on the next
sweep after the neighbouring open block arrives. Existing neighbour mesh
invalidation keeps geometry current. Cache lifetime is one adapter connection;
world-change checks and reconnects discard it. No additional game reads or
gameplay commands are introduced.

### Directional cap edges and diagonal corners

The cap is a composite of dark hidden-rock fill and the actual transparent
wall tiles used by the game. Openness bits are N/S/W/E/NW/NE/SW/SE. Cardinal
openings select the matching native N, N_W, N_S_E, N_S_W_E and related tokens.
A diagonal opening adds NW/NE/SW/SE corner art only when neither bordering
cardinal edge is already open. This covers concave corners without double
painting them. Rough stone, smoothed stone, soil, ice and wooden construction
use their directional families and exposed material tint. Missing mappings keep
the safe dark fill; absent neighbours produce no speculative edges.

Native alpha silhouettes are preserved in separate transparent atlas cells.
Pending/failed rim cells stay transparent, not white. Alpha-tested rim quads
sit 0.004 tiles above the dark base; their holes reveal the base while their
rock pixels use material colour. All geometry still shares one terrain material
and per-block mesh. The rim list is bounded to five references per wall and
validated alongside the 8-bit mask; sealed/unknown cells cannot carry rims.
Neighbour exposure recovers on subsequent reads across block boundaries.

## Screenshot-led premium-art fidelity

The prior physical-RGB multiplication was inappropriate for authored premium
floor art: the installed stone-floor PNG already contains the reference
blue-grey crack palette. Terrain now uses an unlit MeshBasicMaterial, retaining
alpha-tested directional wall rims and the single shared atlas. Floor tops use
a white tint; actual material RGB/name metadata remains available for inspection
and appropriate side/material accents. Cap interiors use the native charcoal
background RGB (49,44,52), avoiding repeated hidden-rock flecks absent from the
reference. Directional edges and diagonal corners remain textured.

Vanilla inorganic raw flags distinguish IS_GEM, METAL_ORE and ordinary vein
stone. Gems select native GEM_A_WALL crystal art; metal ores select
ORE_VEIN_WALL with a pale material accent; ordinary minerals such as mica retain
rock borders and their material colour. This avoids treating all vein stone as
white ore. Exact per-gem graphics style and some border hues remain approximate.
Native tile variant field 7 selects grass variants, with coordinate hashing only
when the variant is absent. Hidden/fully enclosed walls never receive these
material distinctions.

Native stair top art now sits on the floor; primitive stair steps remain the
fallback when artwork is unavailable. Workshop base rectangles receive building
material tint while tool/fire overlays retain their authored colours. Scenery
meshes carry vertex colour, avoiding a material/texture allocation per tint.
BuildingInstance.items field 14 supplies permanent item identifiers for stable
bed details. Native sheet and pillow sprites are layered over bed frames using
a muted deterministic sheet palette. RFR does not export the original graphic
seed, so these are explicitly substitutes, not per-bed colour matches. Detail
layers, RGB and brightness are bounded and validated.

See texture-fidelity-review.md for the fixed critic rubric, comparison crop,
iteration scores and remaining coverage/geometry differences.

## First-person view and overhead streaming

The navigation state machine in scene.ts keeps orbit, camera-point selection and
walking separate. first-person.ts owns pointer lock, yaw/pitch and WASD movement;
all listeners and held-key state are cleaned up on exit/disposal. Movement stays
on the selected Z and treats unknown/unloaded ground as blocked. The player has a
0.18-tile footprint radius and 0.64-tile eye height. Roof data is required before
spawning or crossing a block seam (except at the known top of the map).

The bridge pairs each current-level XY block with its overhead block, then reads
two lower levels. This makes nearby ceilings available before a full-map sweep
finishes, retaining the 4096-block limit. buildMesh's first-person flag permits
only downward underside faces from cut+1; orbit continues to omit that layer.
Unknown and enclosed roofs borrow safe revealed-ground stone artwork with neutral
shading, rather than exporting hidden mineral data. The regular dirty queue,
vertical neighbour invalidation and GPU disposal cover these ceiling meshes.

A click on a valid glowing floor selector stores the orbit camera and requests
pointer lock. Escape releases capture; clicking the viewport recaptures it.
Changing Z, reconnecting or choosing another point returns to selection. No game
commands are used. Stair travel between levels and furniture collision remain
outside this first-person navigation implementation.

## Traversal update

The original same-Z restriction above is superseded by traversal.ts and rampHeight.
Ramp sampling uses barycentric interpolation of the same mesh triangle fan.
Adjacent-level movement requires a ramp and a height-continuous landing; footprint
support may straddle the ramp/landing boundary. Stair connections match the native
up/down captions and interpolate one level per half-second (W up, S down).

The resident stream is now five levels (cut +/-2). Level operations may include
validated in-bounds integer XY focus coordinates; blockOrder sorts nearby chunks
first. No game commands or unbounded volumes are exposed. Expected walking-level
resets clear terrain and sequences while preserving camera and input; movement
waits for the reset and then for revealed support/clearance data to arrive.

Controls explicitly focus the canvas. Pointer lock is optional: on failure,
focused WASD and hover mouse look stay active. Free mouse deltas reset on capture
and pointer leave; Escape, blur and lost lock pause/clear keys. Capture failures
are surfaced in the control banner rather than silently disabling input.

Live traversal refinement: each nearby column now streams all five levels before
expanding across XY. A stair command waits in place while its linked destination
or clearance data is unavailable. When upper-layer data confirms a walkable landing
above a supporting wall, ramp geometry uses those confirmed exits rather than
unrelated side walls. Upper-chunk updates therefore invalidate the 3x3 lower-level
neighbourhood in addition to the current horizontal neighbours and direct upper
neighbour (19 affected keys). See live-navigation-check.md for fresh game evidence.

The ceiling-only first-person mesh branch is superseded: first person now meshes
full terrain through cut+2, while orbit retains its cutaway. Stair centres stay
open using narrow 3D treads, suppressing their flat native top art only in first
person. Scenery and creature visibility use explicit upper/lower bounds so upper
landings and lower floors can both be seen. The ordinary opaque unknown-rock
geometry still conceals unrevealed terrain; sealed/unknown ceiling undersides may
borrow only the revealed tile below's stone artwork. Mesh replacements during
view-height changes preserve existing geometry until queued replacements arrive.
