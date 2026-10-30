# Independent tree visual review

The user requested a specialised Tree Critic, detailed feedback, and iteration
towards **4.8/5 or better**. This review evaluates actual rendered captures,
alongside the locally installed Dwarf Fortress artwork. A score is a visual
judgement, not proof of botanical realism or a substitute for geometry tests.

**Final result: pass, minimum 4.80/5 across all 21 family/state fixtures,
the actual fruit grove and the tower-cap regression.** Pine, cedar and larch
reach 4.85. The final worker-path runtime capture preserves the approved
appearance. Detailed scores and residual limitations are recorded below.

## Rubric and acceptance

| Criterion                                |   Weight | What earns the points                                                                                                                                                                                                   |
| ---------------------------------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native silhouette and species identity   |     1.50 | Revealed DF occupancy, trunk/branch directions and live/bare state remain legible; native family colours and distinctive forms survive the 3D interpretation.                                                           |
| Bark and foliage material                |     1.25 | Native pixels remain readable at useful scale; bark sides do not repeat end-grain stamps; foliage does not become stretched wallpaper, black panels, or flat coloured plastic.                                          |
| Connected organic geometry and grounding |     1.50 | Rounded or softly faceted trunks, tapered branches and credible joints; root contact; no floating foliage, open seams or disconnected chunk boundaries.                                                                 |
| Canopy volume and readability            |     0.75 | Crown volume reads from above, the side and below; varied lobes avoid rigid shelves while preserving gaps and the native occupied footprint. For bare families this measures the clarity of the branch/tube silhouette. |
| **Total**                                | **5.00** | **Every agreed case must reach 4.80; an average must not conceal a failing family or state.**                                                                                                                           |

Acceptance also requires the existing fungal cap/stalk work to remain intact,
no leaves on dead or leafless tiles, no vegetation added to hidden/unknown
tiles, consistent geometry at chunk seams, and relevant automated checks.
Screenshots must be immutable, associated with a stated source revision or
capture round, and fully loaded. A streaming hole is not scored as a tree
geometry defect. Source artwork is used locally for inspection; it is not
redistributed as project assets.

## Coverage agreed with the implementing agent

Adult material families: generic broadleaf, pine, cedar, larch, maple, willow,
kapok, papaya, macadamia, ginkgo, feather tree, glumprong, blood thorn, spore
tree, saguaro, tunnel tube and fungiwood. Many named fruit species have only
sapling/growth overrides and share generic adult artwork. A frozen actual
plum/peach/almond stand supplies a real-world-map check in addition to the
controlled family gallery.

State and topology checks: dead and leafless branches; sparse crown; a broad
2-by-2 trunk spanning a chunk boundary; directional and sloping branches;
trunk/crown viewed from below; and the previously refined tower-cap geometry.

## Baseline observations

Historical `artifacts/trees-oblique-v3.png` and `trees-close-v3.png` expose the
main visual blockers. These partial live streaming captures are useful
diagnostics, but are not a new fully controlled scored baseline.

1. **Trunks look manufactured.** Broad rectangular faces, square corners and
   constant widths make them look like timber posts. Keep the native footprint,
   but interpret exposed edges with a rounded or softly faceted section and
   modest longitudinal variation. Preserve joins between broad trunk cells.
2. **Branches resemble uniform beams.** Horizontal bars terminate abruptly and
   narrow vertical connectors do not consistently explain the weight above.
   Taper away from trunk junctions, embed endpoints into their parent sections,
   and use the native directional information to keep fork paths connected.
3. **Canopies form stacked shelves.** The repeated two-level cuboids produce
   obvious horizontal terraces and repeated square islands. Replace the fixed
   stair-step motif with overlapping irregular volumes whose height, shoulder
   and outline vary deterministically. Keep the native occupied cells and bare
   gaps authoritative.
4. **Leaf sides repeat and stretch.** Broad faces show magnified repeating
   patterns. Native texel scale should remain comparable on top and sides, with
   enough variation in mapping to avoid identical patches on adjacent lobes.
5. **The final view needs more than an attractive overhead crown.** Low-angle
   views must show closed undersides, attachment to twigs and convincing joints.

The previous environment review's 4.5/5 woody-tree result is historical. It is
not a rating for this new work. The separate fungal review's 4.8/5 cap/stalk
result is a regression baseline, not permission to reshape fungi indiscriminately.

## Native material findings

The local definitions are in
`data/vanilla/vanilla_plants_graphics/graphics/graphics_individual_trees.txt`
and `graphics_plants.txt`. Page mappings are in `tile_page_plants.txt`.
Ignored QA references are `artifacts/tree-critic-native-families-1.png` through
`-3.png`, with exact local files and pixel rectangles in
`artifacts/tree-critic-native-families.json`.

| Family                     | Observed native cue                                                                          | Rendering implication                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic / maple            | Bright broad leaves; grey-brown circular trunk with growth rings                             | Retain visible broad-leaf pixels; use rings only on exposed ends.                                                                              |
| Pine / cedar / larch       | Pine needles are darker and fine; cedar denser and softer; larch brighter yellow-green       | Material already supplies useful identity. Avoid replacing these with an identical flat green tint or imposing an invented conical whole tree. |
| Willow / kapok / macadamia | Narrower or elongated leaf marks, varying cluster densities                                  | Preserve their individual source scale; excessive compression erases the difference.                                                           |
| Ginkgo                     | Distinct rounded fan-like leaf marks                                                         | Preserve enough pixel area per patch for the leaf form to remain visible.                                                                      |
| Papaya                     | Pale annular trunk with a dark central core; long leaf marks                                 | Its defined slope-side sprite is fully transparent. A fallback must yield a visible native-derived pale stalk, not an invisible trunk.         |
| Feather                    | Cream trunk and high-contrast white/black foliage pattern                                    | Dark gaps must read as holes or native detail, not large untextured black planes.                                                              |
| Glumprong                  | Muted purple wood; fully transparent full-twig sprites                                       | Keep the bare purple branching silhouette. Do not invent green foliage.                                                                        |
| Blood thorn                | Crimson section and branch material; fully transparent full-twig sprites                     | Keep the native red bare form without green leaves.                                                                                            |
| Spore tree                 | Turquoise speckled section; fully transparent FULL1/FULL2 but nonempty ordinary twig sprites | Use the actual twig sprite: it depicts rounded teal terminal nodules, not a green broadleaf crown.                                             |
| Saguaro                    | Yellow core surrounded by olive-green spiny outer ring; full-twig sprites transparent        | Use green outer tissue for sides and the native cross-section on exposed ends; avoid yellow end-grain stamps down the side.                    |
| Tunnel tube                | Purple outside, red inner rim and dark central mouth; full-twig sprites transparent          | A tube mouth should remain dark/hollow-looking, with a purple outer wall. No ordinary foliage.                                                 |
| Fungiwood                  | Yellow round stalk and orange round terminal growth                                          | Preserve the dedicated fungal interpretation and native orange/yellow identity.                                                                |

The transparent foliage observations are pixel-verified for FULL1 and FULL2:
all 1,024 alpha values are zero in each of the five bare-family source tiles.
Papaya's selected `TREE_TRUNK_SLOPE_NSWE` tile is likewise entirely transparent.
These are source semantics to handle, rather than evidence for adding a
generic fallback crown or generic brown bark.

Further per-token inspection is essential: empty FULL1/FULL2 does **not** mean
all twig graphics are empty. Spore tree ordinary TWIGS has 440 opaque pixels and
TWIGS_NSWE has 833, depicting teal bulb clusters. Saguaro TWIGS has 417 opaque
pixels (a green spiny tip), while several directional twig sprites are empty.
Tunnel tube TWIGS has 657 opaque pixels (a purple/red tube mouth) and NSWE has
886 (a purple tube junction). Glumprong and blood thorn live TWIGS are empty,
but blood thorn LEAFLESS_TWIGS has 124 opaque pixels depicting red thornlets.
The ignored `artifacts/tree-critic-bare-twig-reference.png` records these forms.
Skipping every twig for these five species would therefore be incorrect.

Definition anchors: SAGUARO line 5, TUNNEL_TUBE 401, FUNGIWOOD 561,
BLOOD_THORN 721, SPORE_TREE 1016, GLUMPRONG 1612 and PAPAYA 4163 in the installed
`graphics_individual_trees.txt`. These anchors describe the inspected local
installation and may shift in future game versions.

## Capture rounds

### Baseline: `artifacts/tree-review-baseline`

Inspected all 21 controlled family/state boards and the actual-map grove,
close and underside captures. The controlled gallery deliberately shares an
occupied-cell skeleton; it compares materials and geometry handling, and does
not assert identical natural architecture for all species. The actual snapshot
contains 144 chunks (X 32–79, Y 48–95, Z 171–186), 652 tree cells and eight species.
The capture manifest reports no runtime errors.

Scores below use the four rubric components in their stated order. Repeated
geometry defects receive repeated deductions; their occurrence in many cases
does not make them acceptable.

| Case                  | Identity /1.50 | Material /1.25 | Geometry /1.50 | Volume /0.75 | Total /5 | Specific feedback                                                                                                                                                                      |
| --------------------- | -------------: | -------------: | -------------: | -----------: | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic               |           1.30 |           1.00 |           0.85 |         0.45 | **3.60** | Native leaf marks readable, but flat square crown terraces and a square trunk dominate. Thin horizontal bars remain visible below the lowest ring.                                     |
| Pine                  |           1.35 |           1.05 |           0.85 |         0.45 | **3.70** | Dark fine foliage is distinct; repeated rectangular pads and untapered trunk still look assembled.                                                                                     |
| Cedar                 |           1.35 |           1.05 |           0.85 |         0.45 | **3.70** | Dense softer green material survives, but the same flat slab shoulders and branch lattice remain.                                                                                      |
| Larch                 |           1.35 |           1.00 |           0.85 |         0.45 | **3.65** | Yellow-green needle identity works. Side texture is more compressed than top; crown peaks are small stacked blocks.                                                                    |
| Maple                 |           1.35 |           1.00 |           0.85 |         0.45 | **3.65** | Broad leaves are legible, although bright repeated faces exaggerate the square shelves.                                                                                                |
| Willow                |           1.25 |           0.95 |           0.85 |         0.45 | **3.50** | Long marks survive but become stripy on vertical faces. A softened lobe profile is needed; do not invent unsupported hanging branches.                                                 |
| Kapok                 |           1.25 |           0.95 |           0.85 |         0.45 | **3.50** | Fine elongated leaf texture is noisy at distance; disconnected-looking crown islands sit on constant-width beams.                                                                      |
| Papaya                |           1.00 |           0.65 |           0.25 |         0.45 | **2.35** | Entire trunk and most supporting branches disappear. The tree is a floating crown because the selected side sprite is transparent. This is a release blocker.                          |
| Macadamia             |           1.30 |           0.95 |           0.85 |         0.45 | **3.55** | Native long leaf material is present, with compressed side detail and repeated block-lobe construction.                                                                                |
| Ginkgo                |           1.30 |           1.00 |           0.85 |         0.45 | **3.60** | Fan-like marks are recognisable. Crown roof layers are conspicuous and underside support is a flat timber lattice.                                                                     |
| Feather               |           1.30 |           0.90 |           0.85 |         0.45 | **3.50** | Cream wood is right; high-contrast foliage exposes identical tiles and dense black/white face patterns. Softer volume must not erase the native contrast.                              |
| Glumprong             |           1.35 |           1.05 |           0.80 |         0.55 | **3.75** | Correct purple bare state. Obvious square post and horizontal scaffolding require taper, rounded shoulders and clearer forks.                                                          |
| Blood thorn           |           1.35 |           1.05 |           0.80 |         0.55 | **3.75** | Correct red bare state. Long constant-width bars and sharp elbows dominate without leaves to conceal them.                                                                             |
| Spore tree            |           1.35 |           1.05 |           0.80 |         0.55 | **3.75** | Turquoise speckle is retained; rectangular scaffold still overwhelms the native section.                                                                                               |
| Saguaro               |           0.80 |           0.50 |           0.80 |         0.55 | **2.65** | Exterior is yellow pith with repeated circular stamps, instead of green spiny tissue. Fix material region before tuning geometry.                                                      |
| Tunnel tube           |           0.85 |           0.55 |           0.80 |         0.55 | **2.75** | Flat near-black outer planes and thin red stripes do not read as purple tubes. Distinguish exterior wall from hollow mouth.                                                            |
| Fungiwood             |           1.20 |           0.90 |           1.15 |         0.45 | **3.70** | Round yellow stalk is useful; terminal growth looks like perforated yellow cubes/corn kernels, not the orange round native growth. Preserve stalk improvements while fixing terminals. |
| Dead/leafless         |           1.40 |           1.00 |           0.80 |         0.60 | **3.80** | No accidental leaves; the branch network is connected but highly rectilinear and uniformly thin.                                                                                       |
| Sparse crown          |           1.35 |           1.00 |           0.85 |         0.50 | **3.70** | Open regions remain open. Remaining clusters still look like independent square pads attached to beams.                                                                                |
| Broad trunk / seam    |           1.25 |           0.95 |           0.75 |         0.45 | **3.40** | No obvious seam gap, but broad square stump appears as a masonry block under the crown. Need rounded exterior and coherent texture across joined cells.                                |
| Directional / sloping |           1.35 |           1.00 |           0.90 |         0.60 | **3.85** | Directions visible; protrusions look like cut dowels and abrupt horizontal bars. Need taper and a legible rising connection where slope metadata supplies it.                          |
| Actual fruit grove    |           1.30 |           0.85 |           0.70 |         0.40 | **3.25** | Giant rectangular trunk segments and vertical leaf walls dominate close views; upper branch masses resemble cut blocks. This is the most important real-map improvement target.        |

The baseline `live-under.png` is inside/below the terrain and cannot evaluate
trees. It is excluded from scoring; the implementing agent was asked to move
the camera above ground. The controlled underside panels are valid. A tower-cap
regression capture is still required before the final pass.

Priority order: (1) repair Papaya visibility and Saguaro/Tunnel Tube outer
material; (2) rounded, tapered woody sections with embedded branch joints;
(3) irregular crown volumes and stable native texel scale; (4) close/underside
inspection of the real grove, broad trunks and fungiwood terminals. No case
passes the requested threshold in the baseline.

### Round 1: `artifacts/tree-review-round1`

All 21 boards and actual-map close/grove views inspected after `capture.json`
appeared; the manifest reports no runtime errors. Rounded stems, bent/tapered
branches and curved crown lobes remove the most conspicuous box construction.
Papaya is now visible and native colour identities survive. This is a clear
improvement, but not a pass.

The main remaining defects are specific:

- Leaf shells appear like open baskets of broad diagonal strips in the live
  close view. The implementing agent identified inward winding. This must be
  fixed before judging the final material or volume; apparent holes from an
  inverted shell are not legitimate foliage gaps.
- Whole radial bark sprites repeat as diamond/scaly bands down trunks and pale
  spokes across branches. Use longitudinal native bark such as SLOPE_S, with
  a fully opaque central patch, instead of repeatedly projecting a fork centre.
  Candidate generic sprite: tile (5,1), pixel rectangle [160,32,192,64]; an
  initial central patch [168,42,184,62] avoids the dark fork and transparent edge.
- Canopy lobes read as a collection of almost equal balls. Broader intersecting
  volumes, varied shoulders and lobe proportions should reduce the bead-like
  silhouette without adding occupied cells.
- Saguaro is green now, but black/yellow horizontal checker bands remain.
  Tunnel tube has long near-black vertical panels bordered by purple ladders.
  Both need quieter continuous exterior material sampled from the outer tissue.
- The broad trunk narrows abruptly into a pointed neck under the crown. Its
  shoulders should merge more gently into the actual upper trunk/bough mass.
- Spore tree's ordinary twig cells need their native teal nodule form. Empty
  FULL1/FULL2 is insufficient evidence to treat all its terminal cells as bare.
- Fungiwood terminals are rounded now but read as perforated yellow balls;
  repair winding and retain the native orange surface rather than a yellow
  lattice appearance.

| Case                  | Round 1 /5 | Remaining case-specific blocker                                                                                                                         |
| --------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic               |   **4.15** | Basket-like shell, repeated bark diamonds and equal ball lobes.                                                                                         |
| Pine                  |   **4.25** | Native dark needles help, but open shell and equal rounded beads remain.                                                                                |
| Cedar                 |   **4.25** | Useful dense green material, interrupted by open lobes and radial bark repetition.                                                                      |
| Larch                 |   **4.20** | Needle hue retained; shell breaks and bright diagonal texture strips.                                                                                   |
| Maple                 |   **4.20** | Broad leaf marks retained, yet rounded lobes still resemble individually wrapped balls.                                                                 |
| Willow                |   **4.15** | Long leaf marks become diagonal streaks on shell; bark bands too prominent.                                                                             |
| Kapok                 |   **4.15** | Crown volume better, but repetitive beads and open surfaces remain.                                                                                     |
| Papaya                |   **4.10** | Visibility repaired. Pure pale shaft/boughs need native tissue variation; open leaf shells reveal too much bright branch web.                           |
| Macadamia             |   **4.15** | Texture individuality retained; same shell/ball/material blockers as Kapok.                                                                             |
| Ginkgo                |   **4.20** | Fan-like marks survive, but broad diagonal shell strips distort their reading.                                                                          |
| Feather               |   **4.10** | Cream wood works; stark black/white basket faces and repetitive bark pattern dominate.                                                                  |
| Glumprong             |   **4.20** | Curved purple limbs improved; twig geometry appears on native-empty live twig cells and creates a repetitive cage.                                      |
| Blood thorn           |   **4.20** | Red identity good; same native-empty live twig/cage issue. Preserve nonempty leafless thornlets.                                                        |
| Spore tree            |   **4.05** | Turquoise wood improved, but native teal terminal nodules are absent.                                                                                   |
| Saguaro               |   **3.80** | Green exterior improved; checker rings, yellow interruptions and generic twig cage still obscure cactus tissue.                                         |
| Tunnel tube           |   **3.75** | Rounder form, but long black outer panels/purple ladder seams; native tube-terminal shape not yet clear.                                                |
| Fungiwood             |   **4.10** | Good round stalk retained; terminal growth remains porous yellow balls instead of solid orange volume.                                                  |
| Dead/leafless         |   **4.30** | Taper and bends improve silhouette, but repeated wavy lattice and radial bark bands remain.                                                             |
| Sparse crown          |   **4.25** | Gaps retained and connected; isolated bead-like open lobes need broader shoulders.                                                                      |
| Broad trunk / seam    |   **4.00** | Seam connected, but pointed upper neck and large repeating bark scales are conspicuous.                                                                 |
| Directional / sloping |   **4.35** | Bent tapered branches read better; radial bark and abrupt trunk-to-branch collar still prominent.                                                       |
| Actual fruit grove    |   **3.85** | Rounded trunks and branches clearly improved; close view exposes open basket leaves, oversized repeated bark motifs and abrupt broad-section shoulders. |

The invalid below-ground camera was intentionally kept unchanged for this
comparison; the next round must correct it. Tower-cap regression coverage is
still outstanding. No case yet reaches 4.8.

### Round 2: `artifacts/tree-review-round2`

Inspected all 21 boards, actual close/grove views and the corrected above-ground
underside view. Capture reports no runtime errors. Correct winding closes the
leaf shells; longitudinal bark removes the loud radial diamond pattern. The
ground view now shows credible, continuous branch attachments. Remaining
deductions are material scale, crown composition and special terminal identity.

The actual underside reveals long horizontal green stripes around leaf-lobe
sides. This is not solely the beige twig content of the source bitmap: side
projection uses X and height for every azimuth, stretching faces near constant
X. Choose projection from the actual surface normal or blend native triplanar
samples, so leaf pixels have similar scale on top and side. Dense native FULL1
is a sensible source where 3D twig geometry already supplies the woody detail.

Large trunk sections still stretch a fixed number of source pixels over their
larger circumference. Native bark texel density should stay approximately
constant with trunk width and branch length. The tiny 2-by-4 exterior samples
for cactus/tube exaggerate this: four source rows become four enormous bands
per trunk level. Repeat those pixels at native scale rather than stretching
them. The colour selection itself is now much better.

| Case                  | Round 2 /5 | Remaining visual work                                                                                                           |
| --------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------- |
| Generic               |   **4.45** | Closed crown; equal balls, beige printed twig stripes and side UV stretching remain.                                            |
| Pine                  |   **4.50** | Dark needle material reads well; repeated round beads still need varied shoulders.                                              |
| Cedar                 |   **4.50** | Dense green crown is convincing at distance; bead repetition and close side mapping remain.                                     |
| Larch                 |   **4.45** | Bright needle identity retained; lobe proportions and stretched side marks need refinement.                                     |
| Maple                 |   **4.40** | Broad leaves visible; ball silhouettes and bright side stripes prominent.                                                       |
| Willow                |   **4.40** | Native long leaf marks retained but become striped on curved sides.                                                             |
| Kapok                 |   **4.40** | Better closed volume; repeating lobes and bark scale on large sections remain.                                                  |
| Papaya                |   **4.30** | Visible pale stem; flat pale tissue and bright branch web under repetitive lobes.                                               |
| Macadamia             |   **4.40** | Material identity present, with same round-lobe/side-UV limits.                                                                 |
| Ginkgo                |   **4.40** | Leaf shapes readable from orbit, stretched around side lobes.                                                                   |
| Feather               |   **4.35** | Closed white crown improved; high-contrast marks amplify lobe and mapping repetition.                                           |
| Glumprong             |   **4.35** | Quieter purple wood; native-empty live twig cells still produce repeated cage loops.                                            |
| Blood thorn           |   **4.35** | Red material readable; same live-twig topology mismatch remains.                                                                |
| Spore tree            |   **4.15** | Turquoise stem better; actual twig nodules still absent.                                                                        |
| Saguaro               |   **4.10** | Green tissue restored; enormous horizontal bands and generic cage terminals.                                                    |
| Tunnel tube           |   **4.10** | Purple wall restored; enormous bands and unclear terminal mouths.                                                               |
| Fungiwood             |   **4.50** | Solid orange-yellow terminal growth now reads; near-identical balls still look repetitive.                                      |
| Dead/leafless         |   **4.40** | No leaves and sound attachments, but repetitive wavy cage topology.                                                             |
| Sparse crown          |   **4.45** | Open spaces preserved; separated ball-like leaves need more varied volume.                                                      |
| Broad trunk / seam    |   **4.15** | Connected, but pinched neck and stretched large bark pixels remain.                                                             |
| Directional / sloping |   **4.55** | Clearly better tapered limbs, with modest bark-scale and collar refinement remaining.                                           |
| Actual fruit grove    |   **4.05** | Closed leaf surfaces and quieter bark help substantially; underside still exposes striped leaf balls and oversized bark pixels. |

Next priorities were sent to the implementing agent: normal-aware leaf mapping,
overlapping unequal canopy lobes, native source-specific terminals, deterministic
parent/child twig connections and circumference-aware bark texel density.

### Round 4: `artifacts/tree-review-round4`

Round 3 was used only as a diagnostic comparison for source-aware terminals;
the next fully reviewed set is round 4. All 21 boards plus the actual grove,
close and corrected underside captures were inspected. Source changes were
frozen for the capture. Normal-aware leaf projection repairs side stretching;
dense native foliage removes printed beige twigs; bark density scales better;
and twig parent/child connections remove the artificial cage loops.

Two simpler bare families now meet the visual target. The full set does not.

| Case                  | Round 4 /5 | Remaining blocker or accepted detail                                                                                                                 |
| --------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic               |   **4.60** | Near-equal rounded crown beads dominate despite correct material.                                                                                    |
| Pine                  |   **4.65** | Fine native needles retained; excessive bead repetition is the remaining crown issue.                                                                |
| Cedar                 |   **4.65** | Dense muted green material and connected crown work; same repeated bead silhouette.                                                                  |
| Larch                 |   **4.65** | Bright fine foliage survives projection fix; crown mass still too uniformly lobed.                                                                   |
| Maple                 |   **4.60** | Correct broad leaf texture; equal ball shoulders are conspicuous.                                                                                    |
| Willow                |   **4.60** | Side marks no longer smear into long stripes; needs more varied crown mass.                                                                          |
| Kapok                 |   **4.60** | Native elongated leaves and stable mapping; repeated small balls remain.                                                                             |
| Papaya                |   **4.50** | Visible native pale trunk; pale branch web and bead crown still overemphasised.                                                                      |
| Macadamia             |   **4.60** | Native dense leaf surface works; same geometric crown repetition.                                                                                    |
| Ginkgo                |   **4.60** | Fan-like marks retained with improved side scale; overly circular repeated lobes.                                                                    |
| Feather               |   **4.55** | Native cream/black-white identity preserved; high contrast exposes regular lobes most strongly.                                                      |
| Glumprong             |   **4.80** | Native-empty twig cells now remain empty. Purple trunk and explicit tapered branches read cleanly and are grounded. Minor faceting is acceptable.    |
| Blood thorn           |   **4.80** | Correct red bare structure without invented live twig lattice. Native explicit branch geometry remains readable. Minor faceting is acceptable.       |
| Spore tree            |   **4.35** | Correct teal terminal nodules exist, but projecting the whole cutout creates cracked holes and repeated white outlines on every lobe.                |
| Saguaro               |   **4.45** | Green ribbed tissue is much improved; terminals look sawn flat with exposed yellow pith rather than native spiny green tips.                         |
| Tunnel tube           |   **4.50** | Dark mouths now visible. Exterior repeats as purple plaid instead of calm longitudinal tube tissue.                                                  |
| Fungiwood             |   **4.55** | Round yellow stalk remains sound; repeated disc perimeters make orange/yellow terminal surfaces patchy.                                              |
| Dead/leafless         |   **4.75** | Open tapered branch hierarchy, no foliage or cage loops. Slightly abrupt small collars remain.                                                       |
| Sparse crown          |   **4.60** | Empty regions retained, support coherent; remaining clusters too ball-like.                                                                          |
| Broad trunk / seam    |   **4.40** | No visible seam opening, but the upper section contracts into a sharp narrow neck.                                                                   |
| Directional / sloping |   **4.75** | Native directions retained with credible taper and attachment. Small collars could blend more gently.                                                |
| Actual fruit grove    |   **4.25** | Bark and foliage mapping much better; nonrectangular joined trunks remain plate-like with repeated per-cell disks, and leaves are conspicuous balls. |

Specific next changes requested:

1. Use one broad irregular primary leaf mass per occupied cell, with only one
   or two smaller unequal shoulders. The current primary radii vary by less
   than 10%, preserving the repeated grape appearance. Proposed initial ranges:
   horizontal radii roughly 0.42–0.48 and 0.35–0.45; vertical radius 0.25–0.32;
   smaller shoulders 0.16–0.27, with deterministic rotation and branch direction.
   Adjacent-cell bridges should merge shoulders without becoming extra beads.
   Reduce isolated-lobe lighting contrast slightly while retaining a dark underside.
2. Give connected nonrectangular trunk sections a shared rounded outline and
   coherent top/underside instead of separately capped cell cylinders. Blend
   broad-section shoulders into the upper trunk and boughs.
3. Keep Spore/Fungiwood as separate rounded terminals. Use opaque native
   interior material once geometry supplies the nodule form. Pixel-verified
   spore candidate: TWIGS tile (0,14), local [4,12,12,20], global
   [4,460,12,468], eight square pixels containing four native green colours.
   Fungiwood FULL1 central [104,8,120,24] is a fully opaque yellow/orange patch.
4. Dome cactus terminal tissue with green native material rather than exposed
   pith. Keep tube mouths open/dark. A calmer opaque tube wall is present in
   TREE_TWIGS_NSWE at tile (3,14): local [12,2,20,30], global
   [108,450,116,478]; an alternate [112,450,120,478] includes more purple variation.
   Both were pixel-verified. Preserve the red annulus for exposed mouths.

### Round 7: `artifacts/tree-review-round7`

Rounds 5 and 6 were intermediate diagnostics. In round 5, the shared irregular
trunk outline removed individual cylinder seams, but mirrored UV coordinates
only at widely spaced vertices skipped texture repetitions on long edges.
The top also stretched one small crop over several cells. The critic requested
edge subdivisions at texture turns and native-scale top mapping. Round 7
includes those refinements, opaque special-family terminal surfaces, cactus
green domes, the calmer tube wall and gentler broad-trunk taper.

All 21 case boards and the actual-map views were reviewed. The implementing
agent also reported passing checks for L-shaped notches, enclosed unknown
centres, chunk seams, an acyclic twig hierarchy, directional dead wood and
outward-facing leaf surfaces. Visual review is consistent with those results.

| Case                  | Round 7 /5 | Assessment                                                                                                                                                          |
| --------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic               |   **4.70** | Native dense leaves, stable mapping and broader masses work; repeated rounded cell-clumps remain visible.                                                           |
| Pine                  |   **4.75** | Dark fine needles and coherent canopy; mild repeated clump rhythm remains.                                                                                          |
| Cedar                 |   **4.75** | Dense muted crown reads well; same residual clump rhythm.                                                                                                           |
| Larch                 |   **4.75** | Bright fine native foliage preserved; still regular at the occupied-cell scale.                                                                                     |
| Maple                 |   **4.70** | Correct broad leaves; repeated oval shoulders remain more conspicuous than desired.                                                                                 |
| Willow                |   **4.70** | Native narrow leaf marks retain scale; orderly oval clumps remain.                                                                                                  |
| Kapok                 |   **4.70** | Material works; crown still shows individual repeated cushions.                                                                                                     |
| Papaya                |   **4.70** | Native pale trunk stays visible and grounded; crown/bright supporting web still looks somewhat orderly.                                                             |
| Macadamia             |   **4.70** | Correct leaf surface with residual clump repetition.                                                                                                                |
| Ginkgo                |   **4.70** | Fan-like marks readable; repeated oval masses remain.                                                                                                               |
| Feather               |   **4.70** | Cream wood and high-contrast native foliage intact; clump structure is still conspicuous.                                                                           |
| Glumprong             |   **4.80** | Previous pass retained.                                                                                                                                             |
| Blood thorn           |   **4.80** | Previous pass retained.                                                                                                                                             |
| Spore tree            |   **4.80** | Opaque pale-teal nodules now read cleanly, attach to turquoise branches and avoid cutout holes.                                                                     |
| Saguaro               |   **4.80** | Green ribbed tissue and domed spiny tips resolve the exposed-pith error.                                                                                            |
| Tunnel tube           |   **4.70** | Longitudinal purple exterior works; red mouth rim is weak/culled from above. Implementer identified winding correction.                                             |
| Fungiwood             |   **4.80** | Solid native yellow/orange terminal growth, round stalk and visible supporting branches.                                                                            |
| Dead/leafless         |   **4.80** | Tapered hierarchy and attachments read cleanly; no accidental foliage.                                                                                              |
| Sparse crown          |   **4.75** | Open native regions remain open and supported; a little oval-clump repetition remains.                                                                              |
| Broad trunk / seam    |   **4.70** | Texture and continuity sound; upper neck still conspicuously contracts under crown.                                                                                 |
| Directional / sloping |   **4.80** | Correct directions, taper, connected closed limbs and grounded trunk.                                                                                               |
| Actual fruit grove    |   **4.60** | Native-scale materials and continuous trunk outline improve it substantially; close canopy still resembles oval cushions, and broad exposed tops remain shelf-like. |
| Tower-cap regression  |   **4.80** | Fresh top, side and underside captures retain the native U footprint, joined round stalk, closed underside and cap texture; no air gap or panel seam.               |

The tower-cap files are `tower-cap-top.png`, `tower-cap-side.png` and
`tower-cap-underside.png`. Minor inherited crown humps remain acceptable under
the prior fungi review. Approved special families should not be restyled
merely to raise a whole-gallery average. Remaining work is concentrated in the
ordinary canopy composition, broad-trunk shoulders and the tube rim winding.

### Round 9: visual target met

Round 8 corrected tube-rim/inner-wall winding, closed solid trunk undersides
and bounded foliage to occupied cells. The tube then reached **4.80**: the
native annular rim and dark inner mouth were visible from orbit, with no
missing interior faces. This pass was preserved in round 9.

The full round-9 set, `artifacts/tree-review-round9`, was then inspected:
21 family/state boards plus actual grove, close and underside views. Its
manifest reports no browser errors. The final visual improvement is evident:
unequal, rotated crown masses break the regular cushion rhythm; native sloping
trunk cells read as thick connected bends; and broad shoulders ease into upper
boughs instead of ending at the previous abrupt neck or flat shelf.

**All agreed woody/fungiwood cases now reach at least 4.80/5.** This is a score
for a native-pixel voxel interpretation of the revealed DF structure. It does
not claim botanical reconstruction beyond the source data. Minor cell-layer
clumping, visible native end sections and small faceted boughs remain; these
are why the result does not receive 5.0.

| Case                  | Identity /1.50 | Material /1.25 | Geometry /1.50 | Volume /0.75 | Total /5 | Final visual finding                                                                                                                                                           |
| --------------------- | -------------: | -------------: | -------------: | -----------: | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic               |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Broad native leaves and varied rotated shoulders form a coherent supported crown. Minor occupied-layer clumping remains.                                                       |
| Pine                  |           1.50 |           1.20 |           1.45 |         0.70 | **4.85** | Dark fine needles remain distinct on a connected, varied crown without invented whole-tree conical architecture.                                                               |
| Cedar                 |           1.50 |           1.20 |           1.45 |         0.70 | **4.85** | Muted dense foliage retains its native character; rounded shoulders and bark scale are consistent.                                                                             |
| Larch                 |           1.50 |           1.20 |           1.45 |         0.70 | **4.85** | Bright fine leaf/needle detail survives on top and side, with visible crown variation.                                                                                         |
| Maple                 |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Broad bright leaf pixels remain readable; individual masses no longer repeat as an identical ball row.                                                                         |
| Willow                |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Narrow leaf marks retain scale without the earlier side streaks; native branch occupancy remains authoritative.                                                                |
| Kapok                 |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Dense elongated foliage and irregular shoulders read consistently from orbit and below.                                                                                        |
| Papaya                |           1.50 |           1.15 |           1.45 |         0.70 | **4.80** | Pale native tissue is visible, grounded and connected. Its simpler pale material is accepted rather than replaced with generic brown bark.                                     |
| Macadamia             |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Native dense long-leaf character retained; crown volume and supporting branches remain legible.                                                                                |
| Ginkgo                |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Fan-like native marks remain legible around varied volumes; no obvious stretched side bands.                                                                                   |
| Feather               |           1.50 |           1.15 |           1.45 |         0.70 | **4.80** | Cream trunk and high-contrast native foliage are preserved without open black panels. Fine contrast remains intentionally busy.                                                |
| Glumprong             |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Purple explicit branches and empty live-twig semantics retained; no invented crown.                                                                                            |
| Blood thorn           |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Red bare form remains distinct; no accidental live-twig lattice or green leaves.                                                                                               |
| Spore tree            |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Opaque pale-teal native nodule material, turquoise supporting wood and closed rounded terminal volumes.                                                                        |
| Saguaro               |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Olive-green ribbed tissue with rounded spiny tips; yellow pith is confined to exposed trunk sections.                                                                          |
| Tunnel tube           |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Violet longitudinal exterior, visible annular mouths and dark interiors; no culled inner wall.                                                                                 |
| Fungiwood             |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Native orange/yellow solid terminals, round yellow stalk and supporting branches remain clear.                                                                                 |
| Dead/leafless         |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | A connected tapered bare hierarchy replaces the closed grid cage; no foliage is added.                                                                                         |
| Sparse crown          |           1.45 |           1.20 |           1.45 |         0.70 | **4.80** | Native empty gaps remain open, with unequal supported leaf clusters and no floating floor pads.                                                                                |
| Broad trunk / seam    |           1.50 |           1.15 |           1.45 |         0.70 | **4.80** | Continuous broad section, stable bark scale, gentler upper taper and no visible chunk seam. A native broad-to-narrow change remains legible.                                   |
| Directional / sloping |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Correct directional limbs and a thick tapered slope connection, with closed ends and grounded support.                                                                         |
| Actual fruit grove    |           1.50 |           1.20 |           1.40 |         0.70 | **4.80** | Close and underside views show connected bends, mounded broad shoulders, native-scale bark and varied supported crowns. The revealed source still yields chunky layered trees. |

The tower-cap regression remains **4.80**, based on the fresh round-7 top,
side and underside set; its dedicated geometry was preserved.

Before final runtime signoff, the implementing agent is moving the same tree
meshing off the rendering thread after measuring some dense chunks above
100 ms synchronously. This is a runtime change, not a reason to alter the
approved appearance. A final capture must verify complete worker output,
no browser errors and unchanged family/state/regression visuals.

### Final runtime signoff: `artifacts/tree-review-runtime10`

**Unconditional visual signoff: 4.80 minimum, with the round-9 per-case scores
retained.** The complete final capture uses the worker meshing path and reports
zero browser errors. The critic compared every family/state render panel with
the approved round-9 panel and inspected the final actual-map views.

- Twenty of the 21 controlled render panels are pixel-identical to round 9.
  The broad seam panel differs at one pixel out of 768,000, without a visible
  change to continuity, material or silhouette.
- Actual grove, close and underside views retain the approved appearance.
  They differ at 143, 160 and eight pixels respectively out of 1,400,000 per
  image (at most 0.01143%). No missing worker geometry, new gaps or material
  changes are visible.
- Fresh tower-cap side and underside images are pixel-identical to the
  previously reviewed set. The top image differs at four of 785,200 pixels,
  with no visible regression. Its 4.80 rating is retained.
- The implementing agent reports **246 tests across 44 files passing** and a
  successful production build, including the geometry/occupancy/worker checks.
  This critic independently verified the visual evidence rather than rerunning
  the same suite during the final capture.

The final result keeps native colour and surface character, closes the former
floating/invisible geometry failures, softens trunks and crown masses, and
distinguishes bare wood, cactus tips, spore nodules and hollow tubes correctly.
Remaining native cell-layer clumping, exposed end sections and small facets
are minor accepted limits. There are no outstanding visual blockers in the
agreed coverage. Native reference images and capture boards remain ignored QA
artifacts; no installed game artwork is bundled with the project.
