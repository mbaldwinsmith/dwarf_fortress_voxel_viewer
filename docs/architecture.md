# Architecture

`src/bridge` owns the local HTTP/WebSocket server, DFHack TCP connection,
protobuf subset and RemoteFortressReader adapter. `src/shared` defines validated
viewer messages, tiles and session state. `src/viewer` contains the Three.js scene,
mesh builder, connection and HTML controls. No framework or external services.

## Data flow

The bridge opens one loopback TCP connection only while viewers are connected.
It sends the 12-byte DFHack v1 handshake, binds a fixed allowlist of nine reader
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
closed. Face variant one is an explicit approximation because RFR does not expose
the game random-part index. Hair/beard conditions remain unimplemented.

The browser composites selected local PNG rectangles onto an in-memory canvas.
Large-image rectangles anchor at the bottom-right normal tile; world scale remains
32 pixels per 1.2 tiles. Exact skin palette colours are remapped from the declared
default row. Item colours use approximate shaded material/dye tint, not the full
DF material/profession palette algorithm. Composites are GPU textures with a
256-appearance limit and are never written to disk or included in build output.
Inventory changes alter the composition key; snapshots replace the material on
the existing billboard. Unsupported or failed composites retain markers.
