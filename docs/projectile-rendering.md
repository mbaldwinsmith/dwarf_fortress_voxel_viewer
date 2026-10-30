# Physical projectile rendering

Implemented 2026-10-30 for DF 53.16 / DFHack 53.16-r3 / RFR 0.21.0.

Arrows, bolts (including dart-like ammunition), thrown items, ballista ammunition
and catapult stones are read from RemoteFortressReader's physical item projectile
list. No scripts create projectiles or modify the fortress.

## Data and rendering

- The wire subset includes `Item.subpos_x/y/z` (9–11), `projectile` (12),
  `velocity_x/y/z` (13–15) and `volume` (16). Item identity, type, material and
  integer position use the existing fields.
- RFR's `CopyProjectiles` appends all `proj_itemst` instances to the first returned
  map block. A single previously loaded, non-air block is requested with
  `forceReload: false`. The reply remains separate from the terrain cache.
- The adapter resolves definitions, distinguishes ammunition types, deduplicates
  item IDs, limits snapshots to 512 items and filters against loaded, revealed
  terrain. Vehicles with fractional coordinates but no projectile flag are ignored.
  Flying items do not require the `on_ground` flag.
- Dedicated messages carry a session, monotonic tick and complete snapshot.
  Empty snapshots remove ended flights. The existing serial RPC connection polls
  at a 75 ms target, also during terrain polling pauses. Mining retains priority.
  Each poll checks world identity before and after its read.
- Arrows, bolts and ballista ammunition use the installation's straight ammunition
  artwork on crossed planes with a solid shaft, facing the exported direction.
  Stones use faceted geometry and material colour. Thrown weapons and equipment
  use their local native sprites; unsupported artwork has a material-coloured
  geometric fallback. Artwork is never bundled.
- Rendering interpolates observed positions over a bounded interval of 40–150 ms.
  RFR's velocity is used for orientation, not real-time integration: its straight
  flight vector does not specify tiles per second. Repeated positions settle
  immediately. No unobserved impacts, trajectories or trails are invented.
- The viewer checks the current cut and terrain visibility each frame. Segments
  crossing unknown/unloaded tiles or exceeding 64 tiles snap to the observed
  destination. Disappearance, reset and disposal remove geometry; a 1.5-second
  silence expires stale flights without allowing an old tick to revive them.

## Verification

255 tests across 45 files, TypeScript and the production build passed. Nine new
focused tests cover pinned fields, all item categories, visibility, malformed
messages, one-block polling, interpolation, orientation, pause, ordering,
landing, expiry, resets and resource disposal. The existing Vite bundle-size
advisory remains.

Ignored local QA artifacts:

- `artifacts/projectile-fixture.ts`: reads actual installed graphics and live item
  definitions/materials; creates controlled fixture data without changing DF.
- `artifacts/projectile-gallery.mjs`: renders five categories through the real
  viewer, using its native-art endpoint and an isolated test WebSocket. Captures
  `projectiles-overview.png` and `projectiles-close.png`.
- `artifacts/projectile-visual-audit.json`: five visible objects, no browser
  errors; the arrow moves from X 3.5 through X 3.867 to X 4.5, remains at X 4.5
  when paused, and leaves no object after the landing snapshot.
- `artifacts/projectile-live-audit.mjs` / `.json`: a 20-second read-only live
  stream check received 148 snapshots while 1,984 terrain blocks streamed.
  Intervals were 79 ms minimum, 121 ms median, 161 ms p95 and 299 ms maximum.
  There were no active projectiles during this observation; real combat was not
  exercised or triggered for testing.

Run these with the bundled Node runtime, the existing viewer on port 5173 and
bridge on 4174. The fixture script uses `node --import tsx`; the others use `node`.
Freeze production source during browser captures.

## Limits

This is a sampled view. Flights beginning and ending between polls can be missed;
DFHack stalls and terrain/creature reads can increase the interval. Landed items
return through the existing ground-item refresh. Positions outside the loaded
view are excluded. Visibility has the same cache freshness as terrain.

Ballista ammunition currently uses its native base shaft graphic; separate fitted
arrowhead metadata is not exported by `CopyItem`. Generic thrown items use
billboards rather than arbitrary 3D equipment models. Magic `proj_magicst`
projectiles remain outside RFR's physical-item export and are not implemented
here; existing fire/dragonfire flow rendering is unaffected.

Primary references: the pinned DFHack
[protocol](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/proto/RemoteFortressReader.proto),
[projectile and block reader](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/remotefortressreader.cpp)
and [item reader](https://github.com/DFHack/dfhack/blob/0bf381cc/plugins/remotefortressreader/item_reader.cpp).
