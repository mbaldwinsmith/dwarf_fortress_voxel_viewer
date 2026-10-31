# Independent wall and floor surface critic review

## Scope and evidence gate

This pass covers wall and floor material selection, natural smoothing, constructed
finishes, and engraving placement and artwork. It preserves the accepted furniture
(`final1`/`final3`), tree (`runtime10`) and workshop (`runtime20`) passes. The critic
edits only this document; production code, artwork and fortress state are read-only.

**Latest verdict: accepted. All 116 final surface cases meet both independent
criteria, with a minimum model/placement score of 4.85/5 and texture score of
4.85/5.** Final evidence is `surface-review-final1` plus the four constructed-ice
cases in `surface-review-final3`. The final material audit covers all 387 selected
installed IDs as routing/swatch evidence, with gameplay-valid cases distinguished
from forced fallback probes below. Earlier failed rounds remain in this document
to make the actual review and corrections traceable.

**Pass requires model/placement >= 4.8/5 and texture >= 4.8/5 for every applicable
case.** A high average cannot compensate for a failed material or finish. There
are scored render rounds below. Source inspection and tests establish coverage,
but do not establish rendered fidelity. Earlier verdicts are retained as iteration
history; the latest evidence section controls acceptance.

Native pixels and generated comparison images belong exclusively in ignored
`artifacts/`. The initial enlarged native crop board is
`artifacts/surface-critic-native-reference.png`. It is evidence, not distributable
project artwork. No native pixels are embedded in this document.

Sources inspected locally:

- `src/bridge/terrain-art.ts`, `adapter.ts`, `scenery-graphics.ts` and
  `wall-tiles.ts`; `src/viewer/mesh.ts` and `terrain-atlas.ts`.
- Installed DF 53.16 `data/vanilla/vanilla_environment/graphics/graphics_tiles.txt`
  and `tile_page_environment.txt`, and the referenced PNG sheets.
- Installed DFHack `hack/scripts/internal/quickfort/dig.lua`, whose header states
  that its designation rules match the in-game UI. `is_hard`, `do_smooth` and
  `do_engrave` are the local evidence for the finish eligibility below.
- The pinned `RemoteFortressReader.proto` engraving and tile definitions.

## Valid finish states

Natural `STONE`, `FEATURE`, `LAVA_STONE`, `MINERAL` and `FROZEN_LIQUID` walls and
floors can be smoothed. Soil, sand, grass and living/dead tree tissues do not gain
a natural stone-smoothing stage merely because the viewer accepts a boolean.

Construction is already a finished state, and the installed smoothing rule
explicitly rejects it. Do not claim independent rough/smoothed construction
variants without native evidence. The installed engraving rule requires a
`SMOOTH` wall or floor and no existing engraving; it has no material or
construction exclusion. Therefore an actual smooth construction carrying a valid
engraving must not lose it solely because its material is wood, metal or glass.
This is a distinction between a native state and the availability of dedicated
art for that state.

The bridge's broad `smooth` boolean includes special 11 (`SMOOTH_DEAD`) as well
as special 3 (`SMOOTH`). That convenience must not turn dead tree tissue into
engravable masonry. Ramps, stairs, fortifications and walls currently collapsed
from other DF shapes are not additional ordinary WALL/FLOOR engraving cases.

An engraving record is authoritative for engraving presence and its direction.
Smoothing alone, a decorative native floor tile, an engraving designation, or
`quality` does not establish that a completed engraving exists. RFR exposes
`floor`, cardinal and diagonal direction flags, `hidden`, `quality`, `tile`, and
an optional art image. The installed surface sheets contain generic engraving
motifs, not a separate illustration of every historical image. A native generic
motif is acceptable; claiming that it depicts the individual recorded subject
without evidence is not.

## Initial coverage matrix

Each checked surface/finish cell below expands to a separate case and separate
pair of scores. `WR/FR` means rough wall/floor, `WS/FS` smooth wall/floor,
`WE/FE` engraved wall/floor, and `WC/FC` constructed wall/floor. Thus `N05-WE`
cannot pass on evidence from `N01-FE`. The baseline matrix contains 66 positive
cases: 42 natural cases and 24 construction cases. Additional distinct native
material routes discovered during implementation must be added, not folded into
an already passed row without visual evidence.

| Family ID | Material family                    | Required wall cases | Required floor cases | Distinctive evidence and subcases                                                                                                   | Status  |
| --------- | ---------------------------------- | ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| N01       | Natural layer stone                | WR, WS, WE          | FR, FS, FE           | Neutral and strongly coloured actual stone; actual material must win over generic terrain class.                                    | Pending |
| N02       | Natural lava stone                 | WR, WS, WE          | FR, FS, FE           | Actual lava-stone material/colour; no magma artwork on solid rock.                                                                  | Pending |
| N03       | Natural feature stone              | WR, WS, WE          | FR, FS, FE           | Revealed feature material only; no disclosure through enclosed or unknown tiles.                                                    | Pending |
| N04       | Natural non-ore, non-gem mineral   | WR, WS, WE          | FR, FS, FE           | Actual mineral colour; smooth/engraved treatment must override rough mineral routing.                                               | Pending |
| N05       | Natural ore                        | WR, WS, WE          | FR, FS, FE           | Ore artwork belongs to rough reference where appropriate; smoothing must not leave a rough ore rim.                                 | Pending |
| N06       | Natural gem                        | WR, WS, WE          | FR, FS, FE           | Rough gem identity, saturated colour, then correct smoothing/engraving precedence.                                                  | Pending |
| N07       | Natural frozen liquid              | WR, WS, WE          | FR, FS, FE           | Separate rough/smooth ice artwork; engraving is valid state but lacks a dedicated ice-engraved sheet.                               | Pending |
| C01       | Constructed stone/mineral material | WC, WE              | FC, FE               | Source boulder versus block must be traced where available; finished masonry cannot silently collapse to unconstructed smooth rock. | Pending |
| C02       | Constructed wood                   | WC, WE              | FC, FE               | Actual wood species/material; native plank grain and engraving must remain legible without double brown tinting.                    | Pending |
| C03       | Constructed metal                  | WC, WE              | FC, FE               | Actual metal; bars versus blocks must be traced where available; metal highlights and any reinforcement layers remain distinct.     | Pending |
| C04       | Constructed green glass            | WC, WE              | FC, FE               | Dedicated green glass floor; any wall extrapolation must be declared and retain glass character.                                    | Pending |
| C05       | Constructed clear glass            | WC, WE              | FC, FE               | Dedicated clear glass floor, distinct from green and crystal.                                                                       | Pending |
| C06       | Constructed crystal glass          | WC, WE              | FC, FE               | Dedicated crystal glass floor, distinct from green and clear.                                                                       | Pending |

This is a material-family matrix, not a claim that every raw material can be
manufactured into every item. A construction fixture requires a valid native
source item/material combination; do not invent gem blocks, ice blocks, ceramic
blocks, soap masonry or other unusual inputs just to fill a Cartesian product.
If an actual supported source item of another material is encountered, add its
case with the evidence and label the nearest-art fallback honestly. Missing a
dedicated art family is different from an impossible gameplay state.

For "all materials", accompany the imagery with a complete routing manifest of
supported native material IDs, state colours/palettes, source item forms, chosen
family and chosen refs. Every ID must reach its intended route. IDs sharing
identical geometry and artwork can share that visual review, but colour behavior
requires swatches covering every distinct chosen palette/colour and separate
close-ups for the darkest, brightest and most saturated results. One grey stone
and one brown wood screenshot do not establish all-material fidelity.

Negative and preservation controls are required alongside the positive matrix:

| Control                                             | Required behavior                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Soil, each native sand colour and grass             | No fabricated smoothing or engraving; preserve their normal material route.                            |
| Tree tissues, including SMOOTH_DEAD                 | No accidental masonry/engraving route; accepted tree rendering remains intact.                         |
| Ramp, stairs and fortification                      | No ordinary flat floor/wall engraving attached from an unrelated or stale record.                      |
| Unknown and enclosed natural walls                  | No material, finish, engraving or subject information leaks through the cap.                           |
| Hidden engraving detail flag                        | Honor the intended visibility semantics; do not disclose the motif through a generic texture field.    |
| Removed/replaced engraving and partial RFR updates  | No stale engraving on replacement terrain; no erasure merely because an unchanged block is omitted.    |
| Missing material, missing art and failed image load | Coherent explicit fallback, with no white holes, neighbouring atlas pixels or false material identity. |
| World change/reconnect                              | Old engraving and palette data cannot survive at matching coordinates in the new world.                |
| Furniture/tree/workshop overlap                     | Surface work must not displace, repaint or flatten the accepted objects.                               |

## Native artwork inventory and crops

All coordinates below are **tile coordinates**, multiplied by 32 for the native
pixel crop. A tile crop is 32 by 32 pixels. Files are under the installed
`vanilla_environment/graphics/images/` directory. The ordinary finished wall
pages are 128 by 160 pixels and use the direction grid below.

| Native use                      | Key or key prefix                                               | File                                                  | Crop/grid                                                                                 |
| ------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rough stone floor               | `STONE_FLOOR_5`                                                 | `floors.png`                                          | (1,4); authored cracked floor.                                                            |
| Smooth stone floor              | `SMOOTH_FLOOR`                                                  | `floors.png`                                          | (6,3); subtle stone plate detail.                                                         |
| Constructed stone floor         | `FLOOR_STONE_BLOCK`                                             | `floor_stone_blocks.png`                              | (0,0); staggered joints and chips.                                                        |
| Engraved floor, palette source  | `FLOOR_STONE_ENGRAVED_PALETTE`                                  | `floor_stone_engraved_palette.png`                    | (0,0); bright grayscale relief/motif source.                                              |
| Engraved floor, authored colour | `FLOOR_STONE_ENGRAVED_NON_PALETTE`                              | `floor_stone_engraved_non_palette.png`                | (0,0); distinct darker blue-grey finish.                                                  |
| Wooden floor                    | `WOOD_FLOOR`                                                    | `wooden_floor.png`                                    | (0,0); diagonal plank/grain pattern.                                                      |
| Metal floor                     | `METAL_FLOOR`                                                   | `metal_floor.png`                                     | (0,0); bright diagonal plate/bar pattern.                                                 |
| Green/clear/crystal glass floor | `GLASS_GREEN_FLOOR`, `GLASS_CLEAR_FLOOR`, `GLASS_CRYSTAL_FLOOR` | `glass_floor.png`                                     | (0,0), (1,0), (2,0); keep distinct authored colours and specular bands.                   |
| Smooth/rough ice floor          | `SMOOTH_ICE_FLOOR`, `ROUGH_ICE_FLOOR`                           | `ice_floor.png`                                       | (0,0), (0,1).                                                                             |
| Smooth stone wall rim           | `SMOOTHED_STONE_WALL_*`                                         | `wall_stone_smoothed.png`                             | Direction grid.                                                                           |
| Engraved wall rim               | `ENGRAVED_STONE_WALL_*`                                         | `wall_stone_engraved.png`                             | Direction grid; small regular top-band marks distinguish the engraving.                   |
| Stone block wall rim            | `ROCK_BLOCKS_WALL_*`                                            | `wall_rock_blocks.png`                                | Direction grid; separate large blocks and joints.                                         |
| Wooden wall rim                 | `WOODEN_WALL_*`                                                 | `wall_wooden.png`                                     | Direction grid; thin brown timber band.                                                   |
| Metal wall rim                  | `METAL_BARS_WALL_*`                                             | `wall_metal_bars.png`                                 | Direction grid; bright metal strip/highlight.                                             |
| Metal reinforcement overlay     | `REINFORCED_METAL_WALL_*`                                       | `wall_reinforced_metal.png`                           | Direction grid; isolated fittings, not a complete wall skin.                              |
| Rough/smooth ice wall rim       | `ICE_WALL_*`, `SMOOTHED_ICE_WALL_*`                             | `wall_ice.png`, `wall_ice_smoothed.png`               | Direction grid; separate treatments.                                                      |
| Rough mineral controls          | `STONE_WALL_*_1..4`, `ORE_VEIN_WALL_*`, `GEM_A_WALL_*`          | `wall_stone.png`, `wall_ore_vein.png`, `wall_gem.png` | Preserve the existing rough-family identity; variant pages have their own larger layouts. |

| Direction  | N   | S   | W   | E   | SE  | NW  | NE  | SW  |
| ---------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tile (x,y) | 0,0 | 1,0 | 2,0 | 3,0 | 0,1 | 1,1 | 2,1 | 3,1 |

| Direction  | S_W | N_W | S_E | N_E | N_S_E | N_W_E | S_W_E | N_S_W |
| ---------- | --- | --- | --- | --- | ----- | ----- | ----- | ----- |
| Tile (x,y) | 0,2 | 1,2 | 2,2 | 3,2 | 0,3   | 1,3   | 2,3   | 3,3   |

| Direction  | N_S_W_E | W_E | N_S |
| ---------- | ------- | --- | --- |
| Tile (x,y) | 0,4     | 1,4 | 2,4 |

`NW` is the single diagonal-corner key; `N_W` is the two-cardinal-edge key. They
are not interchangeable. Review all 15 nonempty cardinal masks, each of the four
diagonal-only corners, and mixtures where a diagonal is already covered by a
cardinal edge. Straight runs, isolated tiles, inner/outer corners, T junctions and
chunk-boundary transitions must all retain the intended finish.

No dedicated glass-wall or wood/metal/glass/ice-engraved sheet appears in this
installed terrain inventory. Mapping a floor texture onto a vertical face, using
a generic engraved motif in another material, or extending native edge pixels
into a full-height side is an explicit 3D reconstruction. Such reconstruction is
allowed if coherent and faithful to the visible native vocabulary, but it must
not be presented as an exact unseen native wall texture.

## Initial implementation risks (unscored)

1. The initial `terrain-art.ts` routes all non-wood construction to smooth stone.
   It misses dedicated block, metal and glass floor treatments and distinct
   construction wall families. A finish flag alone cannot resolve the material.
2. Its mineral branch precedes smoothness for wall rims. Ore and gem material 5
   can therefore keep a rough rim after smoothing. Ice also always selects the
   rough wall family despite the separate native smooth-ice wall page.
3. `surfaces.side` initially receives the entire top-down `N_S_W_E` wall sprite.
   Native rim sprites contain an outline and transparent centre, not a planar
   elevation. Stretching them onto a vertical quad makes picture-frame walls and
   repeats diagonal underside shadows. Engraving would be particularly hard to
   read under that projection. Select a defensible native-derived face treatment
   and keep the native directional art on the cap rim where it belongs.
4. The initial terrain atlas draws transparent source art onto opaque white.
   This is coherent for a deliberate opaque fallback but can expose very bright
   central areas if a rim-only sheet is reused as a full wall. The reinforcement
   sheet is especially unsuitable alone: its north tile contains two detached
   fittings. It needs a base layer if used.
5. Initial floor `topTint` is white while material RGB colours sides. Simply
   adding grayscale palette-art refs can leave every engraved floor grey or
   create an unrelated edge colour. Conversely, multiplying authored wood,
   glass, ice or non-palette engraving by another saturated RGB can double-tint
   the source. Palette replacement and multiplication are different operations;
   a per-material proof is required.
6. Floor artwork must remain on the top surface. The small slab edge and the
   underside must not acquire a complete compressed engraving mural. Wall
   engravings must be on the actual indicated face(s), not copied indiscriminately
   onto every face or the whole top cap.
7. The atlas currently normalizes crops to 32 by 32, with nearest filtering.
   Cropping a thin native band and stretching it to full wall height can magnify
   single pixels into large stripes. Review close and ordinary viewing distances,
   including joints and orientation on opposing faces.
8. Correct visible-wall selection must continue to respect the existing spoiler
   boundary. An engraving on a concealed face is not permission to reveal the
   entire enclosed tile's material or decoration.

## Render review procedure and scoring

Each positive case needs an identified native crop/composite, a clearly labelled
actual input material/finish, top-down or orbit view and a useful low/face-on
view. A whole-room screenshot with an unreadable tile does not replace a close
comparison. Use neutral material controls to judge artwork, then actual material
views to judge colour. Record any native-derived vertical reconstruction as such.

**Model/placement score (5 points):** correct plane, scale and physical support
(2); faithful face/direction and adjacency placement (2); clean corners, slab
edges, occlusion and cutaway behavior (1). A complete motif on the wrong face,
copied onto all wall faces, or visible through concealed terrain cannot pass.

**Texture score (5 points):** correct native artwork/finish family (2); faithful
material/palette and contrast (1.5); motif readability, native pixel character,
orientation and clean filtering/joints (1.5). Generic flat colour, rough ore under
a claimed smooth finish, or missing engraving cannot pass regardless of geometry.

At 4.8, only minor reconstruction differences are acceptable. Visible missing
identity, wrong material family, distorted whole-tile side projections, repeated
engraving on unrecorded faces, white source holes, palette collapse and obvious
seams require another iteration. Every failed case receives a concrete correction
and a subsequent rendered recheck. Scores will be entered only after inspecting
the actual boards, with their artifact directory and iteration recorded here.

**Initial verdict: not rated; rendered evidence pending.**

## Round 1: all 78 boards inspected

Evidence: `artifacts/surface-review-round1/`, including all 78 PNG comparison
boards and `capture.json`; inputs and chosen refs were checked against
`artifacts/surface-cases.json`. The capture reported no renderer errors. Every
board was opened and visually inspected, including its native crops, single-tile
view and repeated-surface view with the adult dwarf. This is an actual rendered
review, not a score inferred from code or the capture's error count.

**4/78 supplied cases meet both numerical thresholds:** `ice-rough-floor`,
`ice-smooth-floor`, `stone-blocks-constructed-floor` and
`stone-blocks-engraved-floor`. This is not acceptance of the whole surface pass.
The remaining 74 cases need correction or replacement evidence, and the
direction/negative/material coverage below remains incomplete.

The reconstructed vertical surfaces are now coherent opaque wall faces instead
of top-down picture frames. A generic native floor engraving is placed as a
square inset panel on each recorded cardinal face. That is an acceptable
**native-derived 3D placement**, not a literal native elevation or an illustration
of the individual engraving's historical subject. The displayed panels retain
their proportions and read at dwarf scale. No score is deducted merely because
the unseen vertical surface requires this declared interpretation.

### Findings that affect multiple cases

1. **Rough surface tint and palette are inconsistent.** Obsidian wall sides are
   completely black. Other rough walls have strongly tinted/darkened sides while
   floor tops remain the same blue-grey stone. Source inspection confirms that
   rough side vertices still receive material RGB in addition to the texture
   path; black RGB destroys all detail. Palette selection must take precedence
   consistently on the top, side and small floor edge.
2. **Smooth surface neutral shades bypass the palette.** Granite, obsidian,
   feature stone, microcline, hematite and ruby smooth faces/floors are all the
   same blue-grey despite differently coloured rims and engraved motifs. Match
   the native tone ramp for these non-key neutral pixels without flattening their
   subtle surface detail. The same failure is visible around engraved panels
   and on engraved floors' exposed edges.
3. **All three metal controls take the stone route.** The captured iron, gold
   and copper cases request `SMOOTH_FLOOR` and `SMOOTHED_STONE_WALL`, not
   `METAL_FLOOR` and `METAL_BARS_WALL`. The smooth blue-grey faces are visibly
   incorrect, even where the rim or engraving is gold/copper coloured. This is a
   material classification problem separate from palette interpolation. Native
   template inheritance must participate in metal identification.
4. **The repeated-wall fixture is not valid adjacency evidence.** Each joined
   wall retains an isolated all-sided cap ring, producing three enclosed dark
   cap centres and internal borders across one continuous wall. The capture
   changes `wallMask` after cloning already decorated tiles, but does not
   regenerate `wallRim`. The model/placement deduction below describes the
   supplied rendered evidence; it is not a claim that production neighbour
   selection has independently been proven defective. Rebuild masks and texture
   refs together before recapture. None of the current boards proves single-face
   engraving placement: all engraved wall inputs use mask 15.
5. **Glass alpha changes the material.** The native `glass_floor.png` uses
   partial alpha: 1,738 pixels at 154, 614 at 144, 348 at 204 and only 372 at 255.
   The native comparison composites this over a dark background, while the
   opaque atlas cell composites it over white. Green becomes pale mint, and
   clear/crystal become chalky white. Choose and document a coherent native-based
   backing/alpha policy, and use the same policy for the native comparison.
   Arbitrary RGB multiplication is not a substitute for resolving that mismatch.
6. **Carvings and their host material diverge.** Ice engravings are grey stone
   plaques on blue ice. Wood sides are pale beige while their rim and carving
   are brown/orange; engraving a wood floor also changes its edge colour.
   Green-glass carving is much darker than its pale host; clear and crystal
   engravings collapse to identical grey. Use the appropriate native material
   tones consistently for the base, rim and generic motif. Preserve grain and
   glass/ice highlights in the uncarved areas.
7. **Feature-state input needs correction.** The feature boards use
   `INORGANIC:ADAMANTINE`, which the installed raws define using `METAL_TEMPLATE`.
   `INORGANIC:RAW_ADAMANTINE` is separately defined in
   `inorganic_stone_mineral.txt`. These six boards are useful render probes, but
   do not establish the requested natural-feature combination. Replace them
   with the evidenced natural material before accepting N03.
8. **Rough gem cap needs a host-edge check.** The ruby cap shows scattered red
   gems over dark fill with no continuous stone edge. The native `GEM_A` crop
   itself is sparse. Check the intended stone-plus-gem composition instead of
   treating an overlay-like gem sprite as a complete wall rim.

### Per-case scores

Each row below represents **two separately inspected PNGs**, whose exact IDs are
the first-column stem plus `-wall` and `-floor`. Model/placement (`M`) and texture
(`T`) are scored independently out of five. The two surfaces are never averaged.
All wall M scores are held below threshold by the visible repeated-cap error and
missing directional evidence; the clean isolated cuboids do not override that
failure. Floor M scores reflect the observed supported slab, correct top plane
and consistent tile scale. A score of 4.85 is a narrow pass, not perfection.

| Case stem                   | Wall M | Wall T | Floor M | Floor T | Detailed correction or finding                                                                                                                                                                                          |
| --------------------------- | -----: | -----: | ------: | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stone-rough`               |   4.55 |   4.00 |    4.90 |    4.55 | Wall face is much darker than its reference and differently toned from the cap. Floor top retains native cracks, but its dark compressed edge and missing consistent granite palette need correction.                   |
| `stone-smooth`              |   4.55 |   4.20 |    4.90 |    4.35 | Wall has a mauve native rim above unrelated blue-grey faces. Floor retains subtle smooth detail but bypasses the selected granite tones. Recolour the neutral source consistently.                                      |
| `stone-engraved`            |   4.55 |   4.40 |    4.90 |    4.65 | Both motifs are crisp and properly planar. Wall's surrounding blue-grey frame and floor's blue-grey edge disagree with the mauve engraving; correct the host surface palette.                                           |
| `lava-rough`                |   4.55 |   1.80 |    4.90 |    3.10 | Wall sides are solid black with no visible source detail. Floor top remains ordinary blue-grey while its edge is black. Remove destructive double tinting and preserve the native dark-material tonal range.            |
| `lava-smooth`               |   4.55 |   3.20 |    4.90 |    2.90 | Obsidian wall has a dark cap but bright generic grey sides. Floor is indistinguishable from lighter stone. Apply the actual native dark ramp to both surfaces.                                                          |
| `lava-engraved`             |   4.55 |   3.70 |    4.90 |    4.35 | Dark motifs match the intended dark palette and remain visible. Broad light grey wall surrounds and slab edges make them look attached to another material; fix the host, not by brightening the engraving arbitrarily. |
| `feature-rough`             |   4.55 |   3.40 |    4.90 |    3.20 | Cyan wall sides are much stronger than the cap/reference; floor is grey with a cyan edge. Correct palette precedence and replace processed ADAMANTINE with the evidenced natural feature material.                      |
| `feature-smooth`            |   4.55 |   3.20 |    4.90 |    3.00 | Only the rim reflects the blue material; wall face and entire floor remain generic grey. Fix neutral-tone routing and the invalid natural-feature material choice.                                                      |
| `feature-engraved`          |   4.55 |   4.10 |    4.90 |    4.45 | Blue motifs are readable and well placed, but the wall frame/slab edge is grey. Replace the material input with RAW_ADAMANTINE and recapture the correct route.                                                         |
| `mineral-rough`             |   4.55 |   3.60 |    4.90 |    3.30 | Microcline wall is highly saturated cyan against a muted cap; the floor top loses the colour entirely. Use one native palette policy without RGB doubling.                                                              |
| `mineral-smooth`            |   4.55 |   3.30 |    4.90 |    3.00 | The rim switches to the correct smooth family, but blue-grey faces and floor do not carry microcline's selected palette. Preserve finish detail while recolouring.                                                      |
| `mineral-engraved`          |   4.55 |   4.10 |    4.90 |    4.45 | Native blue relief is clean. The grey perimeter/edge breaks material continuity; correct it while retaining motif contrast and placement.                                                                               |
| `ore-rough`                 |   4.55 |   3.00 |    4.90 |    3.00 | Hematite sides are almost black-red under a bright ore cap; floor remains grey with a dark red edge. Recover side detail and consistent material tones.                                                                 |
| `ore-smooth`                |   4.55 |   3.20 |    4.90 |    2.90 | Rough ore-rim precedence is fixed, but smooth faces/floor still ignore the red palette. The red cap over grey sides is visibly inconsistent.                                                                            |
| `ore-engraved`              |   4.55 |   4.00 |    4.90 |    4.40 | Red native motifs read at both scales. Grey wall borders and slab edge look like a different supporting material; recolour those areas coherently.                                                                      |
| `gem-rough`                 |   4.45 |   3.00 |    4.90 |    3.00 | Ruby sides are overly saturated and the sparse gem-only cap lacks a clear host-stone edge. Floor is grey with a red edge. Check stone-plus-gem composition and palette precedence.                                      |
| `gem-smooth`                |   4.55 |   3.20 |    4.90 |    2.90 | Smooth rim replaces the rough gem family correctly, but only that rim is red; faces and floor are generic grey. Apply native ruby tones throughout.                                                                     |
| `gem-engraved`              |   4.55 |   4.00 |    4.90 |    4.40 | Red relief is faithful and sharp; grey host areas undermine the material. Preserve the motif while fixing wall surround and exposed floor edge.                                                                         |
| `ice-rough`                 |   4.55 |   4.85 |    4.90 |    4.85 | Native blue diagonal texture and rough rim survive cleanly. Floor passes the supplied case. Wall needs adjacency-correct cap evidence; no texture change is required by this board.                                     |
| `ice-smooth`                |   4.55 |   4.85 |    4.90 |    4.85 | The distinct native smooth floor and smooth ice rim are present, crisp and correctly scaled. Floor passes; regenerate the wall's repeated caps.                                                                         |
| `ice-engraved`              |   4.55 |   3.20 |    4.90 |    3.50 | Grey carving is visibly a different material from the blue ice host; the floor reads as a stone tile resting on ice. Derive native ice tones for the generic engraving and cap detail.                                  |
| `stone-blocks-constructed`  |   4.55 |   4.85 |    4.90 |    4.85 | Native staggered joints, chips and colour are coherent across face and edge. Floor passes. Wall has convincing masonry volume but retains the fixture's wrong internal cap borders.                                     |
| `stone-blocks-engraved`     |   4.55 |   4.85 |    4.90 |    4.85 | Motif, remaining block surround and slab edge share the native material palette. Floor passes. Correct adjacency and provide selective-face evidence before passing the wall.                                           |
| `wood-constructed`          |   4.55 |   4.25 |    4.90 |    4.40 | Grain is clear and the floor source is preserved, but pale base faces differ from the brown rim and later carved finish. Resolve the actual wood material consistently across finishes.                                 |
| `wood-engraved`             |   4.55 |   4.00 |    4.90 |    4.50 | Brown engraving reads correctly; wall still surrounds it with pale planks. The floor edge becomes brown only in the engraved state. Use the same host-material policy before and after engraving.                       |
| `metal-constructed`         |   4.55 |   2.60 |    4.90 |    2.50 | Iron is rendered as smooth stone, with no native metal plate/bar pattern. Fix inherited metal classification, then capture METAL_FLOOR and the appropriate native wall family.                                          |
| `metal-engraved`            |   4.55 |   3.60 |    4.90 |    4.30 | Engraving exists and is readable, but the remaining wall surround and floor edge are smooth stone. Restore metal identity without losing the native carved motif.                                                       |
| `glass-green-constructed`   |   4.55 |   3.90 |    4.90 |    4.10 | Native diagonal bands and border remain sharp, but white backing turns green into pale mint. Resolve alpha/backing and reconcile the dark block rim with the host face.                                                 |
| `glass-green-engraved`      |   4.55 |   3.50 |    4.90 |    3.80 | Very dark green motifs sit inside a pale mint frame or atop a pale slab. Resolve native alpha and material-tone continuity so carving does not look like a separate opaque insert.                                      |
| `glass-clear-constructed`   |   4.55 |   3.90 |    4.90 |    4.10 | Glass pattern is correct, but white compositing makes it chalky and much brighter than the native crop. Preserve its material character with a declared backing policy.                                                 |
| `glass-clear-engraved`      |   4.55 |   4.00 |    4.90 |    4.30 | Motif is clean but reads as grey masonry against a white glass border/edge. Reconcile host and engraving tones and verify clear-glass identity after carving.                                                           |
| `glass-crystal-constructed` |   4.55 |   3.90 |    4.90 |    4.10 | Cool native glass bands survive, but white backing washes out the floor and wall. Keep the subtle crystal distinction while correcting compositing.                                                                     |
| `glass-crystal-engraved`    |   4.55 |   3.80 |    4.90 |    4.00 | Carving becomes identical neutral grey to clear glass, with a pale cool border. Preserve crystal's native tonal identity and fix the host/carving contrast.                                                             |
| `stone-boulder-constructed` |   4.55 |   4.20 |    4.90 |    4.35 | Smooth boulder-construction treatment is distinct from the block control, but face/floor still bypass granite's selected palette. Reconcile grey surfaces with the mauve rim.                                           |
| `stone-boulder-engraved`    |   4.55 |   4.40 |    4.90 |    4.65 | Motif and scale are good. Correct the grey host surround and floor edge; retain the source-item distinction from the block case in the routing evidence.                                                                |
| `gold-constructed`          |   4.55 |   2.30 |    4.90 |    2.00 | Only the wall rim is gold; all major surfaces are smooth grey stone. Fix metal-family classification and native gold palette coverage.                                                                                  |
| `gold-engraved`             |   4.55 |   3.50 |    4.90 |    4.30 | Gold native motif is legible, but wall surround and slab edge remain grey stone. Restore actual metal skin and coherent gold tones.                                                                                     |
| `copper-constructed`        |   4.55 |   2.30 |    4.90 |    2.00 | Copper colour appears only on the cap; major faces/floor are generic stone. Restore metal plate/bar artwork and its copper palette.                                                                                     |
| `copper-engraved`           |   4.55 |   3.50 |    4.90 |    4.30 | Copper carving is crisp, but it is embedded in an unrelated grey host. Fix metal routing and host colour while retaining this native relief.                                                                            |

### Coverage still needed

- All 15 cardinal cap masks, four diagonal-only corners and the stated
  mixed-cardinal/diagonal suppression cases need rendered proof. The current
  source inputs have one isolated wall mask only. Include straight joins, inside
  and outside corners, a T junction and a chunk-boundary join after decoration.
- Engraving on north, south, west and east individually; opposite-face pairs;
  a mixed exposed/occluded mask; diagonal-only engraving; and rear-camera views
  that prove unrecorded faces remain undecorated. Generic panel placement is
  acceptable, but four-side examples cannot prove selective placement.
- Natural feature material must be corrected. Metal bars must actually reach
  the metal route; wood and metal block item forms need selection checks where
  supported. Reference panels should identify the independently expected native
  family as well as the selected ref: the current iron/gold/copper reference
  panels faithfully display the _incorrectly selected stone source_.
- The full material-ID routing manifest and distinct palette/colour swatches
  have not been supplied. Three metals and one wood species do not establish
  all-material behavior. Include dark, light and saturated native colours and
  unknown-material/no-palette fallbacks.
- The negative/preservation controls in the initial matrix remain unreviewed:
  hidden/sealed material, hidden engraving flag, replacement/removal, partial
  updates, reconnect/world change, other terrain shapes and accepted object
  overlap. These do not require changing the user's fortress; isolated fixtures
  and read-only native metadata are sufficient.

**Round 1 verdict: fail overall; 4/78 supplied cases pass, 74 require another
rendered review, and the additional coverage above is pending.**

## Round 2: all 108 boards inspected

Evidence: every PNG in `artifacts/surface-review-round2/`, its `capture.json`
(108 boards, no errors or warnings), and `artifacts/surface-cases.json`.
The 78 material cases were individually inspected, followed by all 11 engraving
direction cases and all 19 actual-adjacency cases. Each board includes the
resolved atlas cells, single view, opposite view and repeated/context view.
The atlas reference is useful for diagnosing projection, but is not independent
proof of native fidelity; the separately inspected installed crops remain the
art reference. Later rounds add an unmodified native crop to each board.

**94/108 cases meet both thresholds in this round: 64/78 material cases and
30/30 direction/adjacency cases.** Fourteen texture cases still fail. All supplied
model/placement cases now meet the threshold. The corrected repeated fixtures
have continuous connected caps instead of isolated rings on every joined tile.
Rear views confirm that panels stay on their recorded cardinal faces.

The metal-family fix is visibly effective for iron, gold and copper. Obsidian
rough faces retain detail, the mineral colours are coherent across tops and
sides, and the feature controls now use `RAW_ADAMANTINE`. Ruby's sparse rough
cap has a host-rock underlay. Glass uses its native partial alpha over a declared
charcoal backing, and its unengraved cap uses a glass panel rather than stone
blocks. These resolve the corresponding round 1 defects.

The remaining failures are two distinct contrast problems. Smooth obsidian and
hematite have almost flat faces because their legacy neutral source colours map
into repeated target shades. The material-derived engraving conversion loses
fine relief in wood and ice, nearly erases the clear/crystal glass motifs, and
completely erases green-glass engraving. Sampling colours by pixel frequency
overweights large flat areas. Use distinct authored shades and the complete
source motif luminance range, then inspect actual replacement renders.

### Round 2 material scores

As before, each stem identifies two separately opened PNGs. M and T are
independent; no wall/floor or model/texture averaging is used.

| Case stem                   | Wall M | Wall T | Floor M | Floor T | Observed result / remaining correction                                                                         |
| --------------------------- | -----: | -----: | ------: | ------: | -------------------------------------------------------------------------------------------------------------- |
| `stone-rough`               |   4.85 |   4.85 |    4.90 |    4.85 | Granite cracks and native mauve tones now agree on all surfaces; joined rough caps are continuous.             |
| `stone-smooth`              |   4.85 |   4.85 |    4.90 |    4.85 | Subtle smooth pattern survives in granite tones; wall rim and slab edge agree with the face.                   |
| `stone-engraved`            |   4.85 |   4.85 |    4.90 |    4.85 | Crisp relief, coherent surround, intact border; panel stays square and supported at dwarf scale.               |
| `lava-rough`                |   4.85 |   4.85 |    4.90 |    4.85 | Dark native detail is recovered; neither side nor floor edge is crushed to solid black.                        |
| `lava-smooth`               |   4.85 |   4.35 |    4.90 |    4.35 | Correct dark material, but the smooth pattern collapses to an almost flat fill. Recover native local contrast. |
| `lava-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 | Dark relief remains legible, with a consistent obsidian surround and edge.                                     |
| `feature-rough`             |   4.85 |   4.85 |    4.90 |    4.85 | Correct raw natural-feature material; blue stone detail is coherent rather than doubly tinted.                 |
| `feature-smooth`            |   4.85 |   4.85 |    4.90 |    4.85 | Raw-adamantine blue is present on the whole finish; smooth detail and cap family agree.                        |
| `feature-engraved`          |   4.85 |   4.85 |    4.90 |    4.85 | Blue relief and host share the material; no processed-metal texture is introduced.                             |
| `mineral-rough`             |   4.85 |   4.85 |    4.90 |    4.85 | Microcline retains native cracks and colour without the former cyan side over-tint.                            |
| `mineral-smooth`            |   4.85 |   4.85 |    4.90 |    4.85 | Smooth native detail is visible and correctly blue, with a smooth rim.                                         |
| `mineral-engraved`          |   4.85 |   4.85 |    4.90 |    4.85 | Motif, surround and slab edge have consistent microcline tones and clear relief.                               |
| `ore-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 | Hematite remains identifiable with recovered face detail and a native ore cap.                                 |
| `ore-smooth`                |   4.85 |   4.40 |    4.90 |    4.40 | Correct burgundy colour and smooth rim, but nearly all subtle face detail is flattened.                        |
| `ore-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 | Red relief remains sharp and integrated with the material; no grey host edge remains.                          |
| `gem-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 | Ruby palette is coherent; rough wall cap now combines the sparse gem marks with host stone.                    |
| `gem-smooth`                |   4.85 |   4.80 |    4.90 |    4.80 | Subtle ruby detail remains discernible; correct smooth precedence. Contrast is the narrowest acceptable pass.  |
| `gem-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 | Ruby relief is readable, consistently coloured and correctly supported.                                        |
| `ice-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 | Native diagonal ice skin and rough rim remain distinct and crisp.                                              |
| `ice-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 | Dedicated smooth ice skin/rim are preserved and connect correctly.                                             |
| `ice-engraved`              |   4.85 |   4.55 |    4.90 |    4.55 | Grey plaques are gone, but the blue conversion compresses the motif contrast and fine relief.                  |
| `stone-blocks-constructed`  |   4.85 |   4.85 |    4.90 |    4.85 | Native block joints/chips are retained; the connected wall has no spurious internal cap rings.                 |
| `stone-blocks-engraved`     |   4.85 |   4.85 |    4.90 |    4.85 | Relief, remaining block surround and narrow floor edge are coherent.                                           |
| `wood-constructed`          |   4.85 |   4.85 |    4.90 |    4.85 | Oak grain, rim and base colour now match; diagonal plank detail remains native.                                |
| `wood-engraved`             |   4.85 |   4.60 |    4.90 |    4.60 | Brown host is correct, but broad two-tone relief loses the native motif's fine modelling.                      |
| `metal-constructed`         |   4.85 |   4.85 |    4.90 |    4.85 | Iron correctly uses the native metal plate/bar skin and metal rim.                                             |
| `metal-engraved`            |   4.85 |   4.85 |    4.90 |    4.85 | Iron relief is clear and its surround remains metal rather than smooth rock.                                   |
| `glass-green-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 | Green native pane and diagonal reflections survive the dark backing; top panels are glass.                     |
| `glass-green-engraved`      |   4.85 |   1.80 |    4.90 |    1.80 | The carved region is solid green: the complete border and central motif have disappeared.                      |
| `glass-clear-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 | Native grey/warm highlights remain distinct from crystal; no white alpha washout.                              |
| `glass-clear-engraved`      |   4.85 |   3.60 |    4.90 |    3.60 | Only a very faint central shape remains; the native border is erased by tone conversion.                       |
| `glass-crystal-constructed` |   4.85 |   4.85 |    4.90 |    4.85 | Cool native pane colour/reflections are retained and distinguish this from clear glass.                        |
| `glass-crystal-engraved`    |   4.85 |   3.50 |    4.90 |    3.50 | Nearly invisible relief; restore source contrast while retaining the crystal tone.                             |
| `stone-boulder-constructed` |   4.85 |   4.85 |    4.90 |    4.85 | Smooth boulder construction is correctly coloured and distinct from block masonry.                             |
| `stone-boulder-engraved`    |   4.85 |   4.85 |    4.90 |    4.85 | Granite relief and smooth host are consistent; source-item distinction remains visible.                        |
| `gold-constructed`          |   4.85 |   4.85 |    4.90 |    4.85 | Correct gold metal family, plate/bar pattern and bright native palette.                                        |
| `gold-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 | Gold relief is readable; its exposed surround and floor edge remain metal.                                     |
| `copper-constructed`        |   4.85 |   4.85 |    4.90 |    4.85 | Native copper plate/bar texture replaces the former grey stone route.                                          |
| `copper-engraved`           |   4.85 |   4.85 |    4.90 |    4.85 | Copper motif and remaining metal surfaces are coherent, sharp and correctly scaled.                            |

### Round 2 direction and actual-adjacency scores

The direction filename prefix is `direction-`; all end in `-engraved-wall`.
The initial camera sees south/east, the opposite camera north/west. Cardinal
panels appear only where the record says they should. Diagonal-only records use
the appropriate native corner cap art; cardinal sides stay plain. This is an
explicit corner representation, not an invented pair of vertical engravings.

| Direction case |    M |    T | Observed placement                                                               |
| -------------- | ---: | ---: | -------------------------------------------------------------------------------- |
| `north`        | 4.90 | 4.85 | North panel appears only in the opposite view; south/east/west stay plain.       |
| `south`        | 4.90 | 4.85 | South panel appears in the first view; opposite faces stay plain.                |
| `west`         | 4.90 | 4.85 | West panel appears on the opposite view's right face only.                       |
| `east`         | 4.90 | 4.85 | East panel appears on the first view's right face only.                          |
| `north-south`  | 4.90 | 4.85 | Opposed north/south panels; east/west remain unengraved.                         |
| `west-east`    | 4.90 | 4.85 | Opposed west/east panels; north/south remain unengraved.                         |
| `north-east`   | 4.90 | 4.85 | Adjacent north/east faces are engraved, correctly split between the two cameras. |
| `northwest`    | 4.85 | 4.85 | Northwest cap corner only; no fabricated cardinal face panel.                    |
| `northeast`    | 4.85 | 4.85 | Northeast cap corner only; native crop orientation is retained.                  |
| `southwest`    | 4.85 | 4.85 | Southwest cap corner only; both cardinal face pairs remain plain.                |
| `southeast`    | 4.85 | 4.85 | Southeast cap corner only; no adjacent-face duplication.                         |

Actual-adjacency IDs are `adjacency-<mask>-engraved-wall`. Each fixture rebuilds
visibility and texture refs after making actual neighbouring terrain. M=4.85
and T=4.85 for **each individually inspected case** below. These are not scores
inferred from one representative mask. Wide cutaway crops partly clip the outer
fixture, but the central cut edge, its cavity and both relevant cameras remain
inspectable; the context column shows the complete layout.

| Mask | Native edge combination | Observed result                                                                    |
| ---: | ----------------------- | ---------------------------------------------------------------------------------- |
|    1 | N                       | North cavity exposes the central north panel and correct cap edge.                 |
|    2 | S                       | South cavity exposes only the central south panel.                                 |
|    4 | W                       | West cavity/panel is confirmed in the opposite view.                               |
|    8 | E                       | East cavity/panel is confirmed in the initial view.                                |
|   16 | NW                      | Diagonal corner removal has corner art and no central cardinal panel.              |
|   32 | NE                      | Northeast corner is selected correctly without a false edge.                       |
|   64 | SW                      | Southwest corner is selected correctly without a false edge.                       |
|  128 | SE                      | Southeast corner is selected correctly without a false edge.                       |
|    3 | N_S                     | Both opposing cavities expose the correct panels and joined cap edges.             |
|    5 | N_W                     | Adjacent north/west cavities use the cardinal-pair crop, not the diagonal NW crop. |
|    9 | N_E                     | Correct two-edge cap and only the corresponding exposed panels.                    |
|    6 | S_W                     | Correct south/west cavities, panels and connected edge bands.                      |
|   10 | S_E                     | Correct south/east cavities; no internal ring across connected neighbours.         |
|   12 | W_E                     | Opposing east/west panels and straight paired cap edges.                           |
|    7 | N_S_W                   | Three exposed sides use the correct three-edge artwork.                            |
|   11 | N_S_E                   | Three exposed sides are coherent in both cameras.                                  |
|   13 | N_W_E                   | North/west/east combination has no south engraving leakage.                        |
|   14 | S_W_E                   | South/west/east combination has no north engraving leakage.                        |
|   15 | N_S_W_E                 | All four central sides correctly exposed; no false rings on attached neighbours.   |

## Targeted rounds 4 and 5: all 26 replacement boards inspected

Round 3 is superseded and does not receive acceptance scores here. Round 4 has
four dark-stone smooth replacements; round 5 has 22 wood, ice and glass boards.
Both capture manifests report zero errors and warnings. Every replacement PNG
was opened and compared with its unmodified native source crop, resolved cells,
front/opposite geometry and repeated context. The unmodified motif now makes
the tone transformation independently reviewable.

**All 26 replacement cases meet both thresholds.** The table gives separate
scores for each wall and floor PNG, using the same stem convention. This fixes
all 14 round 2 texture failures and rechecks 12 related unchanged treatments.

| Round | Case stem                   | Wall M | Wall T | Floor M | Floor T | Detailed recheck                                                                                                  |
| ----: | --------------------------- | -----: | -----: | ------: | ------: | ----------------------------------------------------------------------------------------------------------------- |
|     4 | `lava-smooth`               |   4.85 |   4.85 |    4.90 |    4.85 | Native shallow pattern is visible on dark faces, floor and repeated field; black crushing and flat fill are gone. |
|     4 | `ore-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 | Smooth hematite retains the native subtle plate/crack structure in burgundy, with the appropriate finished rim.   |
|     5 | `wood-constructed`          |   4.85 |   4.85 |    4.90 |    4.85 | Oak grain and rim remain crisp with stable brown tones; construction is not damaged by the engraving fix.         |
|     5 | `wood-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 | Fine native relief returns, including central modelling and outer border, while the exposed host remains oak.     |
|     5 | `ice-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 | Rough ice remains faithful to its distinct native diagonal pattern and rough cap.                                 |
|     5 | `ice-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 | Dedicated smooth ice pattern/rim survive unchanged, including bright and dark native blue detail.                 |
|     5 | `ice-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 | Full motif and border are legible in ice tones at close and dwarf scale; no grey plaque or lost relief.           |
|     5 | `glass-green-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 | Native green pane and reflections remain coherent on face, top and edge.                                          |
|     5 | `glass-green-engraved`      |   4.85 |   4.85 |    4.90 |    4.85 | Previously missing motif is fully restored, with crisp green relief and native glass around it.                   |
|     5 | `glass-clear-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 | Clear glass retains grey/warm native bands and the declared dark-backed appearance.                               |
|     5 | `glass-clear-engraved`      |   4.85 |   4.85 |    4.90 |    4.85 | Central motif and complete border return; relief uses clear-glass tones and a consistent host.                    |
|     5 | `glass-crystal-constructed` |   4.85 |   4.85 |    4.90 |    4.85 | Cool crystal native hue and reflections remain distinct from clear glass.                                         |
|     5 | `glass-crystal-engraved`    |   4.85 |   4.85 |    4.90 |    4.85 | Full cool-toned motif is readable, including fine central detail; clear/crystal no longer collapse together.      |

The tonal and vertical placements remain declared derivations of native art.
The renderer does not gain unseen bespoke ice/wood/glass engraving sheets, nor
does this generic motif claim to depict a particular recorded historical image.

## Complete installed material-ID swatch audit

Inspected `artifacts/surface-material-manifest.ts`,
`artifacts/surface-material-manifest.json` and **every swatch in all nine**
`artifacts/surface-material-swatches/materials-01.png` through `materials-09.png`.
The live material list supplies 387 selected IDs: 70 woods, 26 metals, three
glass types, one ice material and 287 IDs in the broad stone/block routing probe.
Each has a constructed/smoothed and an engraved swatch. All displayed pairs have
coherent native family selection and a visible engraving motif. The dark,
bright and saturated palettes include readable black bronze/black stone,
white metals/light woods, blue/green/red stones and coloured subterranean woods.
The silver swatch was additionally enlarged to check its fine metal highlights
and engraving; both are intact.

This audit establishes **ID routing and palette coverage**, not 387 new valid
construction recipes. It deliberately forces generic block input for many
inorganics. Soil, gems, liquids, glazes and generated placeholder substances in
that broad list must not be advertised as constructible masonry. The 27 records
without state colour remain coherent neutral native fallback controls. The
manifest does not prove that such a placeholder's eventual generated in-world
colour is known. Native family geometry is rated from the actual renderer boards
above; flat swatches do not earn independent model scores.

Every swatch sheet passes texture/routing inspection at 4.85/5 for its stated
purpose. The exact native dark palette rows can have low-contrast block joints;
their engraving remains visible. This is distinct from the fixed accidental
loss of the legacy smooth texture and material-tone motifs. The swatch capture
has one generic HTTP 404 warning recorded, with no visible missing native
texture; its resource URL still needs attribution before calling the capture
fully clean.

## Acceptance items still open after targeted review

The latest supplied image for each of the 108 positive cases now meets both
thresholds. **Final overall acceptance remains pending**, because the later
legacy-contrast correction can affect routes beyond the four recaptured smooth
stone cases. Confirm unchanged output or provide a final capture from the final
code before carrying earlier passing scores forward.

Mixed cardinal/diagonal suppression and a chunk-boundary join still need their
declared evidence. The initial negative/preservation controls remain technical
acceptance checks; their absence does not lower the visual scores of the
positive cases, but those positive cases cannot prove hidden-state exclusion,
refresh/reconnect behavior, unsupported shape rejection or preserved objects.
No native artwork or screenshots have been added to tracked project files.

## Final1: complete current-code recheck

`artifacts/surface-review-final1/` contains 112 actual renderer boards and a
clean capture manifest (zero errors and warnings). All 112 were visually
rechecked using 28 complete four-board contact sheets in the ignored
`artifacts/surface-critic-final-contact/` directory. None of the original board
content was omitted. The four added cases were also opened at original size.
An independent pixel comparison of the rendered columns against the latest
previously reviewed boards found 40 identical cases and 72 changed/new cases;
the latter were not accepted merely because their previous versions passed.
`comparison.json` records each comparison. This complete recapture closes the
concern that later palette changes might invalidate the targeted review.

**112/112 final1 cases pass both criteria.** The following matrix is the final1
score for each wall and floor case, not an average across finishes or materials.
The detailed observations in prior rounds still explain the corrections. The
new ruby smooth evidence visibly retains more of the native shallow pattern,
raising that texture score from its earlier narrow 4.80 to 4.85.

| Material / case stem        | Wall M | Wall T | Floor M | Floor T |
| --------------------------- | -----: | -----: | ------: | ------: |
| `stone-rough`               |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-smooth`              |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-engraved`            |   4.85 |   4.85 |    4.90 |    4.85 |
| `lava-rough`                |   4.85 |   4.85 |    4.90 |    4.85 |
| `lava-smooth`               |   4.85 |   4.85 |    4.90 |    4.85 |
| `lava-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 |
| `feature-rough`             |   4.85 |   4.85 |    4.90 |    4.85 |
| `feature-smooth`            |   4.85 |   4.85 |    4.90 |    4.85 |
| `feature-engraved`          |   4.85 |   4.85 |    4.90 |    4.85 |
| `mineral-rough`             |   4.85 |   4.85 |    4.90 |    4.85 |
| `mineral-smooth`            |   4.85 |   4.85 |    4.90 |    4.85 |
| `mineral-engraved`          |   4.85 |   4.85 |    4.90 |    4.85 |
| `ore-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 |
| `ore-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 |
| `ore-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 |
| `gem-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 |
| `gem-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 |
| `gem-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 |
| `ice-rough`                 |   4.85 |   4.85 |    4.90 |    4.85 |
| `ice-smooth`                |   4.85 |   4.85 |    4.90 |    4.85 |
| `ice-engraved`              |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-blocks-constructed`  |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-blocks-engraved`     |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-boulder-constructed` |   4.85 |   4.85 |    4.90 |    4.85 |
| `stone-boulder-engraved`    |   4.85 |   4.85 |    4.90 |    4.85 |
| `wood-constructed`          |   4.85 |   4.85 |    4.90 |    4.85 |
| `wood-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 |
| `metal-constructed` (iron)  |   4.85 |   4.85 |    4.90 |    4.85 |
| `metal-engraved` (iron)     |   4.85 |   4.85 |    4.90 |    4.85 |
| `gold-constructed`          |   4.85 |   4.85 |    4.90 |    4.85 |
| `gold-engraved`             |   4.85 |   4.85 |    4.90 |    4.85 |
| `copper-constructed`        |   4.85 |   4.85 |    4.90 |    4.85 |
| `copper-engraved`           |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-green-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-green-engraved`      |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-clear-constructed`   |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-clear-engraved`      |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-crystal-constructed` |   4.85 |   4.85 |    4.90 |    4.85 |
| `glass-crystal-engraved`    |   4.85 |   4.85 |    4.90 |    4.85 |

The 11 final1 direction cases and 19 original adjacency cases each retain their
separate round 2 scores after this rendered recheck: cardinal direction cases
M=4.90/T=4.85; diagonal direction cases M=4.85/T=4.85; every original adjacency
case M=4.85/T=4.85. The four added cases are scored separately below.

| Added final1 case              |    M |    T | Observed result                                                                                                                    |
| ------------------------------ | ---: | ---: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `adjacency-65-engraved-wall`   | 4.85 | 4.85 | North edge plus southwest corner coexist correctly; the north cavity has its panel, unrelated cardinal faces stay plain.           |
| `adjacency-18-engraved-wall`   | 4.85 | 4.85 | South edge plus northwest corner use independent native edge/corner contributions without a false cardinal panel.                  |
| `adjacency-129-engraved-wall`  | 4.85 | 4.85 | North edge plus southeast corner retain orientation and connected cap appearance from both views.                                  |
| `chunk-boundary-engraved-wall` | 4.85 | 4.85 | Actual cross-chunk wall join has one continuous cap; the engraved tile and plain neighbour keep their separate correct face state. |

The mixed image cases are disjoint edge/corner combinations. Overlapping-corner
suppression is checked separately by the existing `wall-neighbours.test.ts`
assertion that mask `1 | 32` selects only `N`, while `1 | 64` selects `N, SW`.
It is technical coverage, not an additional photographed case. White/light
centres in the final reference-only cut-edge swatches show the opaque preview
backing; the production rim is sampled with transparency and lies over the dark
cut cap. No such white fill appears on the actual rendered walls.

### Final material audit and live integration

All nine regenerated `artifacts/surface-material-swatches-final/` sheets are
pixel-identical to the nine fully inspected material sheets above. Their final
capture contains all 387 IDs and now reports **zero errors and warnings**,
closing the earlier unassigned HTTP warning. The routing/texture score remains
4.85 for every sheet, with the same explicit distinction between gameplay-valid
material cases and forced routing/fallback probes.

Opened and inspected `artifacts/surface-live-final.png` and its telemetry JSON.
The read-only live map has coherent rough and smooth coloured terrain, visible
dark cap boundaries and no white texture holes. The recorded settled state has
2,304 chunks, 57 creatures, 1,395 smooth tiles and 787 atlas slots with zero
pending images; repeated samples show no growing atlas usage or browser errors
or warnings. This is an integration check, not extra proof of engraving or
construction: neither state is present in this loaded live sample. Their
acceptance rests on the actual renderer fixtures and native data transport
checks, not a claim that they were seen in the fortress.

### Technical acceptance checks read independently

- `surface-finishes.test.ts` checks source-item field 18, material routes,
  finished mineral precedence, native ice and gem host composition, removal of
  black double tint, bounded/deduplicated masks, hidden/rough/sealed record
  rejection, floor-versus-wall masking, all four panel positions and occluded
  neighbour culling. It also protects alpha, palette validation and the rare
  highlight case that previously erased glass relief.
- `chunk-loading.test.ts` supplies successive fresh engraving snapshots and
  proves removed/hidden records clear even when the map block otherwise repeats.
  `applyEngravings` clears previous tile masks before applying each fresh column
  snapshot. Unknown shapes cannot receive a floor/wall face bit; ramps, stairs
  and other non-wall/non-floor shapes yield no engraving faces.
- `engraving-rpc.test.ts` verifies the fixed read-only Lua script and strictly
  bounded numeric column arguments. The inspected script reads under suspension,
  checks both the engraving's hidden flag and actual tile visibility, and emits
  positions/masks only. It does not change game state or expose art subjects.
- `wall-neighbours.test.ts` verifies mixed-corner suppression and transparent
  rim sampling. The rendered final boundary fixture complements its neighbour
  and diagonal chunk-corner checks.

The implementer reports 307 passing tests in 50 files and a successful
production build. These technical results close state/transport checks; they
are not the basis for the numerical visual scores. A newly identified
constructed-ice route is still awaiting its own four rendered controls before
the whole expanded material pass is closed.

## Final3: constructed ice and final acceptance

The final material-route audit identified solid `WATER` on a construction tile
(material class 7) as an additional case. It must retain ice identity even though
the tile class no longer says natural frozen liquid. This adds C07, constructed
ice, with constructed and engraved wall/floor cases. As with other source-item
probes, the block input tests precedence over generic block artwork; this does
not assert that every arbitrary material/item pairing is a production recipe.

Opened all four original-size boards in `artifacts/surface-review-final3/`.
Its manifest reports four boards and zero errors or warnings. The discarded
final2 preload capture is not acceptance evidence. The new route selects smooth
native ice for the finished construction and preserves its native material tone
for carvings. The inspected condition adds only actual `WATER` constructions to
the existing ice branch; the previous natural-material cases remain applicable.

| Exact case ID                        | Model/placement | Texture | Observed result                                                                                                      |
| ------------------------------------ | --------------: | ------: | -------------------------------------------------------------------------------------------------------------------- |
| `ice-construction-constructed-wall`  |            4.85 |    4.85 | Finished blue ice face, native smooth rim and continuous repeated cap; no stone blocks or grey palette substitution. |
| `ice-construction-constructed-floor` |            4.90 |    4.85 | Correct native smooth-ice top and supported edge, retaining bright and dark native bands.                            |
| `ice-construction-engraved-wall`     |            4.85 |    4.85 | Full native-derived blue motif and border, square inset placement and coherent ice surround/cap.                     |
| `ice-construction-engraved-floor`    |            4.90 |    4.85 | Readable full-tile ice relief, correct horizontal placement and unchanged narrow ice edge.                           |

The added technical test exercises all four states with actual `WATER` and block
component metadata. The implementer reports the final total of **308 passing
tests in 50 files** and a successful build.

Preservation was also checked at the pipeline boundary: `terrainPalette` and
`terrainTone` are imported only by `TerrainAtlas`; scenery/furniture retain the
existing `recolor` path. Tree/fungi/projectile atlas requests do not request the
new palette, tone or glass backing. The inspected glass backing is explicitly
opt-in, preserving ordinary transparent atlas compositing. Geometry and approved
profiles from furniture final1/final3, trees runtime10 and workshops runtime20
are not replaced by this surface pass.

The intentional shared bridge correction is inherited metal identification.
Read `artifacts/surface-furniture-routing.json`: all 18 actual `buildingObjects`
combinations (table, chair, cabinet, bookcase, statue and pedestal, each in iron,
gold and copper) resolve to `material=metal` and the already approved native metal
sprite keys; pedestal retains its shared native key. This verifies that the
loader correction reaches the intended approved profiles without inventing new
furniture geometry. It is a routing check, not a claim that those 18 objects
received a new independent visual review in this surface pass.

**Final independent surface verdict: accepted.** The complete final set has
82 material/finish/surface cases, 11 direction cases, 22 actual-adjacency cases
and one chunk-boundary case: **116/116 pass**, with both criteria individually
at least 4.85/5. The 387-ID swatch audit passes its stated routing/texture purpose;
negative state, visibility, refresh and bounded transport controls are supported
by the reviewed source/tests. No unresolved observed defect remains in this
surface scope.

This acceptance retains the precise limits established above: vertical wall
skins and panels are declared native-derived 3D placements; engravings use a
generic installed motif, not the individual historical subject; diagonal-only
records are represented by native cap corners; native glass uses a declared
opaque dark backing; generated/no-colour records receive an explicit neutral
fallback. The live snapshot proves integration and smooth terrain, while
construction and engraving fidelity are evidenced by the actual renderer
fixtures. The critic changed no production files, native artwork or fortress
state; all inspection images and crops remain ignored artifacts.
