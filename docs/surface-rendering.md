# Wall and floor finishes

Updated 2026-10-31. This pass adds visible engravings and material-aware smoothed
and constructed terrain using the installed vanilla environment sheets. The
independent visual scores and iteration history are in
[surface-critic-review.md](surface-critic-review.md).

## Native materials and placement

| Surface                                                            | Native source                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Natural rough/smooth stone, feature stone, lava stone and minerals | Rough stone floor skin / `SMOOTH_FLOOR`; directional rough/smoothed wall rims                                |
| Rough/smoothed/constructed ice                                     | `ROUGH_ICE_FLOOR` / `SMOOTH_ICE_FLOOR`, with the matching ice wall rims                                      |
| Stone-block construction                                           | `FLOOR_STONE_BLOCK` and `ROCK_BLOCKS_WALL_*`                                                                 |
| Boulder construction                                               | Smooth stone skin and rim, distinct from manufactured block joints                                           |
| Wood construction                                                  | `WOOD_FLOOR` and `WOODEN_WALL_*`, resolved through the actual wood material palette                          |
| Metal construction                                                 | `METAL_FLOOR` and `METAL_BARS_WALL_*`; inherited `METAL_TEMPLATE` flags identify metals                      |
| Green, clear and crystal glass                                     | Their separate `GLASS_*_FLOOR` sheets on solid faces and caps                                                |
| Floor engravings                                                   | `FLOOR_STONE_ENGRAVED_PALETTE`                                                                               |
| Wall engravings                                                    | Inset vertical panels from that native motif, plus `ENGRAVED_STONE_WALL_*` on the recorded exposed cut edges |

The wall-side use of floor/material skins and the inset engraving are deliberate
3D interpretations. Native wall sheets are top-down transparent edge diagrams;
they are retained on cutaway edges rather than stretched over the vertical wall.
The generic native carved figure is **not a literal reconstruction of the
historical subject in a DF art-image record**. No new bitmap artwork is generated
or shipped. There is no dedicated native glass-wall sheet.

Material colours use installed descriptor palettes, including an RGB-to-native-
palette lookup for wood and other material records. Legacy neutral environment
shades interpolate through the native cool palette ramp; their original contrast
is retained when a dark palette would flatten the pattern. Exact native palette
colours stay exact. Wood, ice and glass carvings use the distinct shades of their
own native material skin, with the full source motif's dark-to-light range.
Unidentified/no-colour materials retain neutral native fallback art.

Glass artwork contains partial alpha. Solid glass terrain deliberately composites
it over the charcoal cut-rock backing, rather than white. This is a solid voxel
surface treatment, not physical refraction or see-through wall geometry. The
backing option is glass-specific; existing tree/projectile texture compositing
is preserved. Rough gem rims include a continuous host-rock edge beneath their
native gem overlay.

## DFHack data and refresh

The restricted RFR protocol now decodes `MapBlock.construction_items` field 18 to
distinguish blocks from boulders and other building components. Actual material
IDs still come from RFR's material pairs and definitions; no wall/floor material
is guessed from the underlying geology.

RFR's engraving list uses plugin-global novelty hashes even when a block request
sets `force_reload`. It cannot reliably seed a second viewer or clear a removed
or hidden carving. A fixed, read-only Lua lookup therefore returns a fresh
16-by-16 column spanning at most 16 levels. It runs only for columns containing
potentially engravable wall/floor terrain, examines current engraving records,
checks both engraving-hidden and tile-hidden flags, and returns at most 4,096
position/mask tuples. Numeric arguments, response bounds, duplicate positions
and masks are validated. The lookup scans the world's engraving vector; very
large engraved fortresses still need live timing measurement.

Only recorded face bits are retained: N/S/W/E and four diagonal edge flags, or
the floor bit. Cardinal panels are emitted only on their corresponding exposed
wall face. Diagonal-only records decorate the matching cut corner without
inventing cardinal-face engravings. Enclosed/unknown terrain is redacted before
transmission. Each full column refresh replaces engraving state, so hiding,
removal, reconnects and world changes cannot retain a stale local engraving map.
The existing nearby item refresh retains terrain until its normal full refresh.

Smoothing is a natural-hard-material operation in DF; this renderer does not
invent a separate smooth-wood/metal/glass gameplay state. Constructed surfaces
can carry the engraving records actually supplied by DF. Shape/finish validation
rejects engraving metadata on rough natural terrain, ramps, stairs and hidden
cells.

## Rendering cost and verification

Carved wall panels add one inset quad per exposed recorded cardinal face. Floor
carvings replace the existing top texture. All surfaces remain in the existing
indexed terrain batch, sharing the 2,048-by-1,024 atlas: **8 MiB, no mipmaps, no
extra per-material draw calls**. Palette/tone transformations run once per unique
atlas entry, with cached images and palette rows. Styled UV lookups are cached.
The fixed atlas now uses its previously unused capacity (1,799 artwork slots
plus the fallback slot) without increasing its dimensions; overflow reports a
warning and falls back to flat colour.

308 tests across 50 files and the production build passed. Tests cover native
construction field decoding; material/finish selection; fixed read-only RPC
arguments; fresh, bounded carving snapshots; hidden/sealed/redacted and removed
records; malformed masks/palettes; correct face placement and neighbour culling;
contrast and alpha preservation; and full atlas bounds.

The independent critic passed all 116 final cases, with minimum model/placement
and texture scores of 4.85/5. The live viewer audit loaded 2,304 chunks, 57
creatures and 1,395 smoothed tiles, with zero errors/warnings. Settled atlas use
was 787 entries with no pending loads. The loaded snapshot contained no visible
engravings or constructions; their rendering is fixture-verified, and the
bounded lookup transport was exercised against the running DFHack instance.

Local evidence, excluded from source control and packaging:

- `artifacts/surface-review-final1/`: 112 current-code boards (78 material/finish
  cases, 11 direction cases, 22 adjacency layouts and one chunk-boundary join),
  with native source/resolved texture, two opposing camera views and repeated
  surfaces beside an adult dwarf. Zero browser errors/warnings.
- `artifacts/surface-material-swatches-final/`: nine sheets covering all 387
  selected installed material IDs. These include 70 woods, 26 metals, three
  glasses, water/ice and 287 inorganic stone/block routing probes. Some IDs are
  not constructible game materials; 27 generated placeholder records have no
  state colour and explicitly exercise the neutral fallback. This is a routing
  audit, not a claim that every material can be used for construction.
- `artifacts/surface-review-final3/`: four constructed/engraved ice boards,
  zero browser errors/warnings. The earlier final2 preload coincided with a
  bridge restart; final3 is the clean acceptance capture.
- `artifacts/surface-material-manifest.json`: IDs, native RGB, classifications,
  selected keys and resolved plain/engraved texture metadata.
- `artifacts/surface-live-final.png/json`: read-only live viewer audit.

No fortress changes or installer build. Existing furniture, workshop and tree
geometry remains unchanged; preserve their earlier passing evidence.
