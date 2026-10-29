# Live first-person navigation check

Tested on 29 October 2026 against the loaded **The Dimension of Tempests** fortress,
using DF 53.16, DFHack 53.16-r3 and native RFR 0.21.0. Browser checks used the actual
viewer handlers, WebGL scene and live companion in headless Edge. A second input
case deliberately rejected pointer lock to exercise embedded-browser fallback.
No game commands were sent; only viewer settings/camera movement and terrain reads.

| Check                | Live result                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Select camera point  | Clicked the green selector at X34/Y128/Z128; controls activated                                          |
| Stair ascent         | X34/Y128, Z128 to Z129; camera stayed in first person after the stream reset                             |
| Stair descent        | Returned to the same X34/Y128 column at Z128; controls stayed active                                     |
| Ramp ascent          | Walked from lower floor X28/Y120/Z128 through the ramp at X29/Y120 onto X30/Y120/Z129                    |
| Ramp descent         | Returned down the slope to X28/Y120/Z128, eye height 128.76                                              |
| WASD and mouse look  | Verified strafing displacement and changed camera orientation                                            |
| Escape and recapture | Escape paused controls; clicking restored them                                                           |
| Pointer lock denied  | Focused WASD and hover mouse look worked on actual live terrain; ramp traversal also passed in this mode |
| Browser errors       | None                                                                                                     |

Looking upward from the Z128 stair was also verified: a view ray hit the actual
Z129 wall at height 129.4267, with the camera at height 128.76. The browser was
then driven through the same stair/ramp and input checks with upper geometry enabled.

The live checks exposed and fixed four issues:

- Lower chunks were delayed behind a map-wide upper-layer pass. All five levels
  of a nearby column now load before expanding outward.
- Holding a stair direction before its destination loaded could move sideways.
  The controller now waits in place for the connection/clearance data.
- The tested ramp's side walls raised its low edge. Confirmed upper landings now
  determine uphill supports; its low edge meets the lower floor. Meshing invalidates
  the lower neighbouring chunks when upper landing data changes across seams.
- First person inherited the orbit cutaway, showing only undersides above the
  selected level. It now renders full loaded geometry through two levels above,
  with open-centred 3D stairs and no flat stair sprites covering the shaft.
  Orbit keeps its original cutaway and native stair art.

These fixes have regression coverage for loading order, stair waiting with denied
pointer lock, ramp landing selection, cross-level neighbour invalidation,
upper walls, ceiling undersides and open stair sight lines. All 109 tests pass,
as do strict TypeScript, the production build and formatting checks.
The final live run ended at the original viewer level Z128. The live preview URL
is http://127.0.0.1:5173/.
