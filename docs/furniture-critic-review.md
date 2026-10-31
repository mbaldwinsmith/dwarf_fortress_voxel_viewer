# Freestanding furniture critic review — 2026-10-31

Independent critic: `/root/freestanding_furniture_critic`, newly created for the
user's report that tables and chairs/thrones are too high. Each reviewed family
must score **at least 4.80/5 for model and 4.80/5 for texture separately**.
A mean across families, or one strong category compensating for another, does
not pass. Scores remain pending until the critic has inspected current captures.

## Scope and evidence

The review includes all 17 existing freestanding furniture/storage families and
six additional families: slabs, traction benches, statues, altars, display
pedestals and display cases. Doors, hatches, grates and floodgates are separate
architectural elements and remain outside this pass. Workshop models and their
passing `workshop-review-runtime20` evidence are unchanged.

The reference is the user's locally installed vanilla artwork and current
renderer, including actual native dwarf sprite alpha bounds and body-size/ceiling
fitting. A nominal 1.2-unit sprite canvas is not a visible dwarf's height. Current
first-person eye height is 0.64 above the floor. Every family needs a native
reference, an orbit view, a low/ground view and a dwarf scale comparison. Material
variants must remain recognisable and avoid palette/crop regressions. Capture
names and exact reviewed files will be recorded per round. Native pixels and
screenshots remain in ignored `artifacts/`, never in the repository.

Actual item details omitted by the remote protocol must not be fabricated:
occupied cages, eggs, equipment on empty racks and display contents need evidence.
The user's subsequent clarification explicitly accepts a textured 3D statue
pedestal with a vertical camera-facing statue sprite. Actual displayed items must
use a scaled sprite of the item reported by the game, placed on the stand or in
the case. These accepted sprites do not lose model points for lacking a fully
sculpted body; the pedestal/case still needs coherent volume and grounding.
The selected native chair variant is backless; a backrest is not mandatory merely
because the item is called a chair or throne. Decorative/native-style variants
that the bridge cannot identify are not required to be guessed.

## Rubric

**Model, 5 points:** dwarf-relative scale and functional proportions (2.0), native
silhouette and identity (1.0), coherent support and volume (1.0), and readability
from multiple angles (1.0). A table should sit around a dwarf's waist/elbow region,
well below the first-person eyes. A seat should be around knee height with a
plausible seat-to-table gap. Initial implementation targets are approximately
0.38–0.43 for table top and 0.21–0.25 for seat top, subject to the actual scale
boards. Tall storage can be taller than tables without approaching the ceiling
arbitrarily. Ground contact, clear openings, believable thicknesses and the
absence of billboard-only major structure are required except for the statue
and displayed-item sprites explicitly accepted above.

**Texture, 5 points:** native identity and material/palette fidelity (2.0), clean
crop/UV projection without baked perspective or neighbouring-object ghosts
(1.5), consistent texel scale (0.75), and coherent seams/detail placement (0.75).
Native texture details may sit on proper supported geometry. Solid surfaces must
not contain accidental transparent holes. Grain, handles, rims, books and cloth
must occupy the parts they describe, rather than being stretched over unrelated
faces. Stone/metal/glass variants should retain their native pixel-art treatment;
photorealistic shading is not the goal.

The pass threshold means no remaining material defect visible in the required
views; minor stylistic interpretation may remain. Ratings will not be increased
to satisfy the requested target without new visual evidence.

## Review matrix

| Family               | Model /5 | Texture /5 | Status       |
| -------------------- | -------: | ---------: | ------------ |
| Table                |     4.85 |       4.85 | Pass, final1 |
| Chair / throne       |     4.85 |       4.80 | Pass, final1 |
| Bed                  |     4.85 |       4.80 | Pass, final1 |
| Cabinet              |     4.85 |       4.80 | Pass, final1 |
| Coffin / sarcophagus |     4.85 |       4.80 | Pass, final1 |
| Bookcase             |     4.85 |       4.80 | Pass, final1 |
| Chest / coffer       |     4.85 |       4.80 | Pass, final1 |
| Barrel               |     4.85 |       4.80 | Pass, final1 |
| Bin                  |     4.85 |       4.80 | Pass, final1 |
| Bucket               |     4.85 |       4.80 | Pass, final1 |
| Large pot            |     4.85 |       4.80 | Pass, final1 |
| Cage                 |     4.85 |       4.80 | Pass, final1 |
| Animal trap          |     4.85 |       4.80 | Pass, final1 |
| Weapon rack          |     4.85 |       4.80 | Pass, final1 |
| Armor stand          |     4.85 |       4.80 | Pass, final1 |
| Nest box             |     4.85 |       4.80 | Pass, final1 |
| Hive                 |     4.85 |       4.80 | Pass, final1 |
| Slab                 |     4.85 |       4.80 | Pass, final1 |
| Traction bench       |     4.85 |       4.80 | Pass, final1 |
| Statue               |     4.85 |       4.80 | Pass, final3 |
| Altar                |     4.85 |       4.80 | Pass, final1 |
| Display pedestal     |     4.85 |       4.80 | Pass, final3 |
| Display case         |     4.80 |       4.80 | Pass, final3 |

Scores above use the weakest inspected material variant of each family.
**All 23 families pass both independent 4.80 gates.** The complete final1
regression and the newer final3 statue/display captures were visually inspected;
see the final signoff below for exact evidence and limits.

## Initial source audit

The starting table top is 0.57 above the floor, only 0.07 below first-person eye
height; the starting seat top is 0.35. These values support the user's complaint,
but code dimensions alone are not a visual score. Existing furniture gallery
images predate the current backless-chair implementation and are not accepted as
current evidence.

The bridge already recognises five additional building categories but does not
attach 3D furniture metadata to them: `Slab`, `TractionBench`, `Statue`,
`OfferingPlace` and `DisplayFurniture`. The last category currently selects a
pedestal even though native display-case art exists. Native lookup details to
check include `ITEM_SLAB_BLANK`, `ITEM_TRACTION_BENCH_WOODEN_CHAIN`/`WOODEN_ROPE`,
and distinct `ITEM_TOOL_PEDESTAL`, `ITEM_TOOL_DISPLAY_CASE` and `ITEM_TOOL_ALTAR`.

## Baseline visual review

Inspected the current native/front-orbit/rear-orbit/ground boards in
`artifacts/furniture-review-baseline/`. The dwarf in this first capture resolved
to a shadow only, so **scale/model scores are withheld** until a corrected dwarf
comparison is available. No baseline family passes the combined gate. The
following are visual findings, not scores inferred from code.

| Family               | Detailed feedback for the next iteration                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table                | Shorten the long legs to bring the top well below eye height. The wood leg texture is the whole tabletop crop stretched vertically, creating zipper/ladder marks; fascia squashes it into horizontal stripes. Use material regions with consistent physical texel size and grain along the supports. Recover the subtle native bright edge with a restrained bevel/rim. |
| Chair / throne       | Backless native identity is appropriate. Lower the seat, keep a thinner seat slab and a convincing seat-to-table gap. Wooden legs have the same stretched checker grain as tables; the stone pedestal needs coherent edge definition, rather than a plain block with a tabletop pasted on every side.                                                                   |
| Bed                  | The layered frame/bedding is readable, but boards and feet carry compressed horizontal borders. The pillow contains an accidental dark rectangular patch from its crop. Use clean pillow material, a thinner blanket volume and consistent wood grain; preserve the native blanket pattern.                                                                             |
| Cabinet              | Raised doors and handle placement are useful. The entire side/back body stretches an 18×4 top strip into huge patches, unlike the source material. Use appropriate grain/texel scale on tall body faces and narrower trim. Verify total height beside a visible dwarf.                                                                                                  |
| Coffin / sarcophagus | The tapered closed shape and continuous lid are sound. Side grains reset/stretch per facet, and glass highlights repeat as bright horizontal bands. Keep coherent side planks/material scale and a restrained continuous glass highlight.                                                                                                                               |
| Bookcase             | Native art has two openings, but the model has three; the middle shelf cuts through native rails/books and creates a blank dark slit. Use two aligned recesses and separate book artwork per opening. The case is too deep for the detail to remain visible from orbit. Body texture has the cabinet's giant-patch problem.                                             |
| Chest / coffer       | Lid overhang and latch are readable. Broad checker patches on the top and repeated whole-face stripes on the body lose native material character. Give lid/body/trim distinct clean regions at coherent texel scale; avoid squeezing a whole crop into the narrow edge.                                                                                                 |
| Barrel               | Hollow bulging shell is recognisable, but wood becomes enormous patches. Native staves and blue-grey hoops disappear into flat brown bands. Restore finer vertical stave texture, distinct thin highlighted hoops, rim and a believable dark interior.                                                                                                                  |
| Bin                  | Hollow construction works. Broad stretched stripes and giant rim pixels do not match the native plank/rim character. Texture interior and exterior consistently while preserving real depth.                                                                                                                                                                            |
| Bucket               | The opening works, but the body is broad streaks and the bands/rim lose their native identity. A thin segmented/curved bail would read better than the oversized square handle. Keep the bucket visibly smaller than a barrel.                                                                                                                                          |
| Large pot            | The rounded neck/body profile is recognisable. A few giant grey patches replace the native dense material mottling; preserve finer native texture and lip/shoulder highlights around the curved surface.                                                                                                                                                                |
| Cage                 | Wood bars are completely flat tan, with none of the native edge/wood detail. Glass has the same tan bar model despite clear native panels; give glass a framed glazed enclosure and coherent pane highlights. Retain actual open gaps for wood/metal.                                                                                                                   |
| Animal trap          | Correctly smaller than a cage, but metal is still tan flat colour. Use its actual metal native treatment, readable door frame, thinner bars and grounded low proportions.                                                                                                                                                                                               |
| Weapon rack          | The supports/pegs give useful volume. All material variants remain flat tan, losing native grain and edge highlights. Keep the rack empty unless the protocol reports its contents.                                                                                                                                                                                     |
| Armor stand          | Recognisable post/crossbars/head support, but native metal highlights and material colours are absent. The broad solid base differs from the native open supports; refine grounding/support without inventing armor.                                                                                                                                                    |
| Nest box             | Low open box is appropriate, but it is flat tan and the straw is a flat yellow checker patch. Use native box material and a modest raised, irregular straw tuft within/above the low rim; no invented eggs.                                                                                                                                                             |
| Hive                 | Rounded silhouette is promising. Four simple bands and huge angular texture patches replace dense woven straw. Native art also has a base tray/uprights and a small top nub, currently absent. Entrance should remain attached to the curved wall.                                                                                                                      |
| Slab                 | Still a horizontal sprite. Make an upright thick bevelled slab with grounded foot/base and the available blank native face; do not invent an inscription.                                                                                                                                                                                                               |
| Traction bench       | Still a floor decal. Build a supported low bench, end posts/rollers and the visible rope/chain mechanism. Keep the native upper surface detail on the supported surface.                                                                                                                                                                                                |
| Statue               | The material reference currently selects only the pedestal sprite. The accepted camera-facing statue must use actual available statue art above a separate textured 3D pedestal. Native material-base keys and default/generic statue TOP/BOTTOM keys are distinct. Never billboard the pedestal a second time.                                                         |
| Altar                | Still an upright card. Build a broad cap on narrower stepped support, with native red cloth across the top and modest hanging ends. Do not print the plinth art on the cloth surfaces.                                                                                                                                                                                  |
| Display pedestal     | Still an upright card. Preserve native octagonal/faceted cap and stepped base in real volume. An actual displayed item belongs above the support, scaled to the available surface.                                                                                                                                                                                      |
| Display case         | Still an upright card. Preserve low faceted enclosure, clipped corners and framed glazed lid/panes. A real reported displayed item should be visible inside, with no fabricated contents or duplicate base artwork.                                                                                                                                                     |

Useful baseline examples inspected include `table-wood.png`, `table-stone.png`,
`chair-wood.png`, `chair-stone.png`, `bed-wood.png`, `cabinet-wood.png`,
`bookcase-wood.png`, `chest-wood.png`, `coffin-wood.png`, `coffin-glass.png`,
`barrel-wood.png`, `bin-wood.png`, `bucket-wood.png`, `pot-stone.png`,
`cage-wood.png`, `cage-glass.png`, `animaltrap-metal.png`, `weaponrack-wood.png`,
`armorstand-metal.png`, `nestbox-wood.png`, `hive-wood.png`, `slab-wood.png`,
`tractionbench-wood.png`, `statue-stone.png`, `altar-wood.png`,
`pedestal-wood.png` and `displaycase-wood.png`.

No visual approval has been issued yet.

### Corrected scale reference

`artifacts/furniture-review-scale1/table-wood.png` resolves an actual native adult
dwarf at body volume 60,000. Its .57 table reaches the dwarf's upper torso and
supports lowering the top to approximately .38–.40, with seating around .22–.24
and a .15–.17 seat-to-top gap. Preserve useful tabletop width rather than shrinking
the whole object uniformly. The companion chair-stone board still lacks the
dwarf, so it is not a complete scale check yet. Tall storage should be assessed
independently, provisionally around .65–.75 if the native comparison supports it.

### Clean native material regions for the rebuild

The following rectangles were checked against the local source pixels using
`artifacts/furniture-native-refs.json`. Coordinates are `(x, y, width, height)`
relative to each 32-pixel native tile, not the whole sheet. These are implementation
recommendations, not visual approval. Repeat clean material at consistent physical
texel density; map intentional trim/highlights once to the part they describe.

| Source                                                     | Clean region                    | Use and restrictions                                                                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ITEM_BED_PILLOW_VARIANT:1`, `:2`, `:3`                    | `(13,5,5,3)`                    | All three are fully opaque light pillow colours, with no dark outline. The previous crop reaching x19 crossed the first variant's edge.                                                                           |
| `ITEM_CABINET_WOOD:1`                                      | `(7,20,7,5)`                    | Darker body/back wood without handles, door edges or outlines.                                                                                                                                                    |
| `ITEM_CABINET_STONE:1`                                     | `(7,20,7,5)`                    | Clean native grey stone field with a restrained highlight pixel.                                                                                                                                                  |
| `ITEM_CABINET_METAL:1`, `ITEM_CABINET_GLASS:1`             | `(17,13,6,5)`                   | Plain native grey field. Glass diagonal glare belongs on a separate single detail, never a repeating material tile.                                                                                               |
| `ITEM_TOOL_BOOKCASE_WOOD`                                  | `(5,3,22,5)`                    | Clean lighter top grain; excludes the bright lip at y8. No large vertical material-only area exists among the books. The corresponding cabinet body region is a reasonable darker same-material side/back source. |
| Native bookcase openings                                   | `(6,11,20,6)` and `(6,20,20,6)` | Two distinct shelf interiors. Their dark recess and books are deliberate details; do not repeat them as body material or cut a third shelf through them.                                                          |
| `ITEM_CAGE_WOOD`                                           | `(2,4,2,7)`                     | Clean light wood post material without its outline.                                                                                                                                                               |
| `ITEM_CAGE_METAL`                                          | `(8,4,1,7)`                     | Plain native metal bar. `(2,4,2,7)` also contains the bright outside edge and may be mapped once across a bar, never tiled as a broad body.                                                                       |
| `ITEM_CAGE_GLASS`                                          | `(19,4,6,3)` and `(8,20,6,5)`   | Upper and lower clear panel fields, both alpha192, without diagonal glare. Preserve transparency.                                                                                                                 |
| `ITEM_BARREL_WOOD_EMPTY`, `ITEM_BARREL_METAL_EMPTY`        | `(13,17,8,6)`                   | Fine body/stave variation between hoops, no outline or band.                                                                                                                                                      |
| `ITEM_BARREL_WOOD_EMPTY` hoop only                         | `(11,13,10,2)`                  | Actual blue-grey hoop and bright rim. This is intentional trim, unsuitable for repeating down the vessel body.                                                                                                    |
| `ITEM_BIN_WOOD_EMPTY`                                      | `(8,19,15,3)`                   | Native plank material without the next dark horizontal seam.                                                                                                                                                      |
| `ITEM_WEAPON_RACK_WOOD_EMPTY`, stone and metal equivalents | `(1,15,3,10)`                   | Clean post material with native grain/highlight variation; no outline.                                                                                                                                            |
| `ITEM_ARMOR_STAND_WOOD_EMPTY`, metal equivalent            | `(13,3,5,2)`                    | Clean head-support material; suitable colour/grain source without dark border.                                                                                                                                    |

## Rebuild reviews

### Rebuild1: geometry improves, material mapping still blocks approval

Reviewed every core/storage variant in `artifacts/furniture-review-rebuild1/`:
table/chair/cabinet/bookcase/chest/coffin in wood, stone, metal and glass; bed in
wood; barrel/bin/bucket/animal trap in wood and metal; pot in wood, stone and metal;
cage in wood, metal and glass; rack/stand in wood, stone and metal; nest box in all
four materials; hive in wood. New families were reviewed at the newer rounds below.

The .40 table and .24 seat now have believable dwarf-relative proportions. Main
remaining problems were repeating native highlight/border strips as material,
transparent bucket-handle crops, straw sampled onto every nest-box wall, and
glass panes discarded by the normal alpha threshold. Cabinet/bookcase broad
material patches and repeated coffin/chest shadow rows were also still visible.

**Evidence correction:** initial messages labelled several rebuild1 scale dwarfs
as missing based on the tool's displayed image presentation. Checking the actual
PNG dwarf region found 10,203 skin-coloured pixels in both barrel variants,
chair-wood and table-wood. Those missing-dwarf labels are retracted; the actual
PNG and non-vacuous capture checks take precedence. This does not retract the
earlier baseline shadow-only finding.

### Rebuild2: core furniture passes in part

Reviewed all four materials for tables, chairs, cabinets, bookcases, chests,
coffins and statues, plus the wooden bed in
`artifacts/furniture-review-rebuild2/`.

- Tables and chairs pass: clean supports, native highlights limited to the top,
  a restrained bright rim and corrected height. The backless chair is faithful
  to the selected native variant.
- Bed passes: clean frame grain, readable pillow and native blanket; shallow
  blanket side wrap removes the conspicuous uncovered white mattress block.
- Chests and coffins pass: dark native base rows no longer cross the lids. Coffin
  lids have a coherent slim overhang/seam. Some lid pixels are coarser than body
  pixels; this remains minor stylisation rather than a material-breaking defect.
- Cabinets still need a native top mapped once, with a calmer side/back field;
  a tiny patch containing one bright pixel produces an obvious polka-dot grid.
- Wooden bookcases pass texture at 4.80. Stone still repeats native corner
  structure, and metal/glass still repeat diagonal glare on the sides. The two
  shelf recesses and actual native books are now correctly aligned.
- Statues use the accepted covered native generic statue. Its dark painted base
  duplicates the 3D pedestal, and metal/glass cap glare repeats into radial
  petals. Keep the figure hem: `ITEM_STATUE` cloth reaches row26, so crop to
  height27, removing the solid dark plinth rows27–31. A small native attachment
  foot beside the hem may remain. A height22 crop would visibly cut the cloth.

### Rebuild3: storage and new-family review

Reviewed all storage variants in `artifacts/furniture-review-rebuild3/` plus
`slab-wood.png`, all four traction-bench materials, `altar-wood.png`,
`pedestal-wood.png` and `displaycase-wood.png`. Bookcase changes in this directory
were superseded by the next queued capture and have not been used for approval.

| Family           | Detailed feedback / reason for current score                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Barrel           | Pass in wood and metal: coherent bulging shell, real cavity, native stave character and separate blue-grey hoops.                                                                                                                                                                    |
| Bin              | Pass in both materials: single native bright lip now clearly defines the opening and volume.                                                                                                                                                                                         |
| Bucket           | Pass in both materials: opaque segmented curved bail, actual cavity and restored wood-bucket hoops; appropriately smaller than the barrel.                                                                                                                                           |
| Pot              | Stone passes. Wood and metal still need one thin native bright mouth rim; removing repeated body glare made the opening blend into the dark shoulder. Keep the body free of repeated shiny rings.                                                                                    |
| Cage             | Structure and clear glass panels now work. Restore one thin native bright upper-rail edge, and one restrained diagonal glare detail for glass. Avoid repeating it over every pane or support.                                                                                        |
| Animal trap      | Clean bar colours revealed a previously transparent full roof slab. Replace it with a barred/slatted roof matching the native source. Restore a restrained native upper-rail highlight; the whole model is currently uniformly flat.                                                 |
| Weapon rack      | Wood and stone pass. Metal base still has repeated stripes; use the single native grey field `(2,15,1,1)` for that broad base. Keep existing empty supports and pegs.                                                                                                                |
| Armor stand      | Added lower twin supports resolve the model issue. Wood passes. Stone/metal stems still repeat the bright head patch; use native stem field `(15,16,2,3)` or a plain pixel on verticals, retaining brighter material on the actual head and upper edges of crossbars.                |
| Nest box         | All four pass: correct material walls and rim, an actual shallow straw nest with irregular raised slivers, no invented eggs.                                                                                                                                                         |
| Hive             | Pass: readable woven body, small top nub, attached entrance and grounded wooden tray/uprights without baked black outlines.                                                                                                                                                          |
| Slab             | Needs native short flat peak and sloping shoulders in the extruded outline. Current rectangular cap cuts off the native arched silhouette and the face prints a second base stripe. Blank face `(10,9,11,10)` excludes base/outlines; use geometric bevel and separate stepped foot. |
| Traction bench   | Ropes stop short of the end rails, so it reads as a bed with lines. Add end roller/winch and small crank, attach/wrap rope endpoints. Rotate wood-leg grain; other material textures are clean.                                                                                      |
| Altar            | Volume and red cloth work. Native cap is much brighter than the current dark plinth: use native165 top `(10,12,12,1)` and a restrained bright edge; darker shaft is appropriate.                                                                                                     |
| Display pedestal | Actual displayed crown sprite is well-scaled and supported. Flat cap illumination must be uniform; radial wedges belong to curved sides. Restore thin native cap rim.                                                                                                                |
| Display case     | Actual item is visible inside. Add a low solid wooden body, approximately .10–.12, below the glazed enclosure; current mostly-glass shell resembles a small greenhouse. Keep side panes clean, use native glare once on the roof, and connect frame beams continuously.              |

The captured crown is a fixture for rendering the actual-item sprite path. Its
presence in a review image is not evidence that a live fortress display contains
that crown. Final implementation must use the item reported by DFHack.

### Rebuild4: nineteen families pass; four residual fixes

Inspected all 34 boards in `artifacts/furniture-review-rebuild4/`: all four
cabinet/bookcase/statue/traction-bench materials; all three pot/cage/rack/stand
materials; both animal traps; slab, altar, pedestal and display case.

Cabinets now retain native front and top detail over calm sides. Pots have a
single clear mouth rim. Cages have upper-rail highlights and restrained glass
glare, and animal traps have real barred roofs. Racks no longer have striped
bases. The slab now has the native peaked shoulders and coherent thickness.
Traction-bench ropes attach to a visible roller and crank. Statues retain their
draped hem without the second painted dark plinth. Pedestal cap illumination is
uniform and its rim distinguishes the supported actual-item sprite. These
families pass their model and texture gates.

Four families still require a small final correction:

- Bookcase stone body: the 1×4 strip contains a differing pixel row and makes
  horizontal stripes. Use a single native pixel `(4,13,1,1)`.
- Armor stand stone/metal: the stem strip similarly repeats a light patch.
  Use a single native stem pixel `(15,16,1,1)` on stem/crossbar sides, preserving
  bright head and upper edges.
- Altar: the new bright cap has visible diagonal z-fighting near its back/side
  edge. Remove or separate overlapping coplanar top faces.
- Display case: the actual crown reads as a small upper fragment behind the
  newly raised wooden body. Source inspection subsequently confirmed the anchor
  was already .123 above the .12 body; padded sprite width was shrinking the
  visible item excessively. Fit actual horizontal as well as vertical alpha
  bounds, with the visible bottom above the support and the top below the lid.
  Check a tall native item and a small/flat item too, on both pedestal and case.

No blanket approval of all 23 families has been issued. Final shared-renderer
regression evidence is still required after these corrections.

## Final signoff

**Approved: every one of the 23 reviewed families scores at least 4.80/5 for
model and at least 4.80/5 for texture.** This is a per-family, weakest-material
judgement, not an average hiding weaker variants. There are no outstanding
required visual corrections in the final evidence.

I visually inspected all 66 boards in `artifacts/furniture-review-final1/`, each
with native artwork, front orbit, rear orbit and ground/dwarf scale views:

| Evidence group        | Exact filename stems and material suffixes                                                                                                                                                 | Boards |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----: |
| Core                  | `table`, `chair`, `cabinet`, `bookcase`, `chest`, `coffin`, each with `-wood`, `-stone`, `-metal`, `-glass`; `bed-wood`                                                                    |     25 |
| Storage               | `barrel`, `bin`, `bucket`, `animaltrap`, each wood/metal; `pot`, `weaponrack`, `armorstand`, each wood/stone/metal; `cage` wood/metal/glass; `nestbox` wood/stone/metal/glass; `hive-wood` |     25 |
| Additional furniture  | `slab-wood`; `tractionbench` and `statue`, each wood/stone/metal/glass; `altar-wood`, `pedestal-wood`, `displaycase-wood`                                                                  |     12 |
| Displayed-item bounds | `pedestal-sword`, `pedestal-amulet`, `displaycase-sword`, `displaycase-amulet`                                                                                                             |      4 |

The subsequent horizontal alpha-bounds centering change required an exact new
billboard check. The four statue boards in `furniture-review-final2/` captured
the ochre loading marker before their native sheets were ready: the statue-wood
front panel contained zero bright figure pixels and 12,203 ochre pixels, versus
7,316 bright figure pixels and zero ochre pixels in final1. Those statue captures
are **invalid evidence**, not approved final art. The capture harness was fixed
to preload native sheets and wait for actual scenery material images rather
than their marker placeholders. No production geometry change was required.

I then visually inspected all ten corrected boards in
`artifacts/furniture-review-final3/`: `statue-wood`, `statue-stone`,
`statue-metal`, `statue-glass`, and both `pedestal` and `displaycase` with
`-wood` (crown), `-sword` and `-amulet`. These supersede their final1/final2
counterparts. Complete pedestals and covered figures are present; actual item
sprites are centred, supported and fitted to their available space. The case's
front rail naturally occludes part of an item at some orbit angles; the ground
and opposite views confirm appropriate placement and containment.

Final fixes are visible: stone bookcase and metal/stone stand fields have no
repeated stripe, altar cap has no coplanar hatching, and tables/seats retain their
.40/.24 heights. Other passed variants show no shared-renderer regression.

I also inspected `artifacts/furniture-live-final.png` and its JSON report.
Visible adult dwarves, tables/chairs and beds have coherent relative scale in
the actual fortress, and native coloured blankets/pillows remain readable. The
report records 2,304 loaded chunks, 57 creatures, 21 tables, 21 chairs, 14 beds,
6 nest boxes, 12 barrels and 9 pots, with no browser errors or warnings. This
does not claim occupied-display verification in the live fortress: that
viewport contained no occupied display, so actual-item placement is supported
by the crown/sword/amulet renderer fixtures and the implementation checks.

Scores retain room below 5.00 for the deliberate low-resolution native-art
interpretation, occasional differences in top/body texel scale, and accepted
camera-facing statue/item sprites. Native material art sometimes shares a
palette between named materials; that is preserved. The covered statue remains
an honest generic native fallback when the depicted subject is unavailable.
Workshop runtime20 and tree runtime10 evidence were not changed by this review.
