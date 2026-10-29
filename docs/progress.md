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

- This is the terrain vertical slice. Live units, buildings, liquids, exact
  material identities, local sprites and layered graphics remain unimplemented.
- Terrain covers a fixed viewport-centred 48 × 48 × 5 region. Reconnect with all
  viewer tabs closed to sample another region. No whole-fortress browsing yet.
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
