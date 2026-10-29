# Architecture

`src/bridge` owns the local HTTP/WebSocket server, DFHack TCP connection,
protobuf subset and RemoteFortressReader adapter. `src/shared` defines validated
viewer messages, tiles and session state. `src/viewer` contains the Three.js scene,
mesh builder, connection and HTML controls. No framework or external services.

## Data flow

The bridge opens one loopback TCP connection only while viewers are connected.
It sends the 12-byte DFHack v1 handshake, binds a fixed allowlist of five reader
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
DFHack proxy. HTTP serves only index.html and flat generated asset identifiers
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
Consequently this milestone uses original geometry/colours and serves no DF artwork.

## Source provenance

The small protobuf schema is an independently written, read-only field subset
of the [matching upstream schema](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/proto/RemoteFortressReader.proto).
Message layouts and polling semantics were checked against
[RemoteClient.h](https://github.com/DFHack/dfhack/blob/0bf381cc/library/include/RemoteClient.h),
[CoreProtocol.proto](https://github.com/DFHack/dfhack/blob/0bf381cc/library/proto/CoreProtocol.proto)
and [the plugin implementation](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/remotefortressreader.cpp).
No upstream implementation or game assets are redistributed. Runtime dependencies
retain their own licences in their packages; project code uses the repository MIT licence.
