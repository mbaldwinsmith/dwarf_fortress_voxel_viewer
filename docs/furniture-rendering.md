# Freestanding furniture

The furniture pass covers 23 families: tables, chairs/thrones, beds, cabinets,
bookcases, chests/coffers, coffins/sarcophagi, barrels, bins, buckets, large pots,
cages, animal traps, weapon racks, armor stands, nest boxes, hives, slabs,
traction benches, statues, altars, display pedestals and display cases.
Architectural barriers and the previously approved workshop/tree models retain
their separate generators.

## Scale and native materials

Tables are approximately .40 tiles high and seats .24, calibrated against the
current adult dwarf sprite at body volume 60,000. Beds have a .28 mattress/blanket
surface and a .40 headboard. Storage heights follow their individual silhouettes.
All furniture rests on the revealed tile's actual support height.

`furniture-geometry.ts` tiles clean native material patches at 32 source texels
per world tile. Thin strips that contain a single source row/column avoid
unnecessary subdivisions. Deliberate features such as cabinet doors, bookcase
openings, blanket patterns and polished highlights are mapped once onto their
appropriate faces. The original artwork and palettes come from the user's local
DF installation; no pixels are embedded or redistributed.

Chairs/thrones preserve the native backless silhouette. Cabinet doors have
raised depth, and bookcases use two recessed openings. Native books are artwork,
not a live shelf inventory. Bedding variants remain a stable approximation
because RFR omits DF's sheet/pillow graphic seed. Other unsupported loose
furniture items remain ground sprites; hollow containers still follow normal
pickup/movement filtering. These are viewer interpretations of native 2D art,
not meshes provided by DF.

All 23 families passed independent model and texture scores of at least 4.80/5.
The critic's rubric, per-family scores and detailed iteration feedback are recorded in [furniture-critic-review.md](furniture-critic-review.md).
Local comparison boards use the native reference, front/rear orbit views, and a
dwarf scale view for every available native material variant. The ignored
`artifacts/furniture-reference-data.ts` and `furniture-critic-new.mjs` generate
those fixtures and immutable review rounds.

## Statues and displayed items

The user's accepted statue design is a textured 3D pedestal with an upright
camera-facing native sprite. Its billboard rotates around the vertical axis,
stays grounded on the cap, and fits the visible artwork within a bounded size.
RFR does not export a statue's depicted art-image subject. The native covered
statue is an explicit generic fallback; no historical person, creature or event
is inferred from the building's material.

Display furniture distinguishes an installed pedestal from a display case by
the contained tool's native subtype. RFR supplies contained item records, while
a fixed read-only Lua lookup supplies the missing `displayed_items` IDs. An item
must still exist, be held by that building and have the building's position.
Assignments awaiting hauling do not create floating objects. The renderer uses
the first confirmed, physically contained displayed item's native sprite and
palette, scaled to the stand or the interior of the case. Empty displays stay
empty; racks, stands, cages and nests do not invent inventory or occupants.

The lookup queries only explicit visible building IDs, at most 64 per request,
with at most eight IDs returned per building, a one-second refresh interval and
a bounded cache. It runs on the existing serial RPC connection. Its response is
validated against the requested IDs and the protocol validates the resulting
sprite metadata. It neither scans the world nor changes fortress state.

Sources: DFHack's [building structures](https://github.com/DFHack/df-structures/blob/master/df.building.xml)
define the display assignment vector; its [Lua API](https://docs.dfhack.org/en/stable/docs/dev/Lua%20API.html)
provides the item holder lookup. The local RFR source in `.reference/` documents
the exported contained-item records.

## Architectural barriers and state refresh

Doors, hatches, floodgates and floor/wall grates retain RFR's `active` mapping
(`1` closed, `0` open). Doors swing, hatches lift and open grates/floodgates
retract. Solid panels have opaque cores; grates retain real gaps. Hatches and
floor grates can appear above revealed shafts. Wall orientation is inferred
from neighbouring rock, and hinge placement remains a viewer interpretation.

The nearby item poll refreshes region-wide building records from RFR's first
partial block, including state changes and removals, without replacing terrain
or delaying its sweep. Missing responses preserve prior buildings.

## Rendering and lifecycle

Opaque furniture faces share chunk batches by native sheet/palette. Glass panes
use separate transparent batches with depth writes disabled and a suitable alpha
threshold; the displayed item remains an opaque cutout so it can be seen through
the enclosure. Small native billboards share cached materials, follow cutaway
visibility and release their geometry when a chunk is replaced or removed.

Tests cover revealed-only lookup selection, refresh/batch bounds, confirmed item
correlation, malformed metadata, camera-facing vertical orientation, transparent
pane thresholds, replacement disposal, physical container openings, closed
coffins and seat symmetry. The read-only live smoke test exercised the fixed Lua
transport and missing-building guard. No occupied display was found in that
viewport, so actual item hauling/removal still needs a live occupied-display
observation; controlled fixtures cover those snapshot transitions.

A separate live viewer check loaded 2,304 chunks and 57 creatures with 21 tables,
21 chairs, 14 beds, six nest boxes, 12 barrels and nine pots. It recorded no
browser errors or warnings, and the critic checked the visible furniture's scale
in the actual fortress. Final validation: 283 tests across 48 files and the
production build passed. No installer was built and no fortress state changed.

Final visual evidence is `furniture-review-final1/` (66 native/material/item
boards), `furniture-review-final3/` (ten final centered statue/display boards),
and `furniture-live-final.png/json`. Final2 statue boards are invalid premature
loading-marker captures. The harness now preloads artwork and waits for the
actual scenery material images; final3 recorded zero errors and warnings.
