# Liquids, trees and atmospheric effects

## Liquid volumes

The bridge reads RemoteFortressReader water/magma fields 10/9 and retains depths
1–7 only on revealed tiles. Each surface is exactly `tileZ + depth / 7`; equal
neighbours share a surface without internal faces. Cutaway tops remain visible
when a continuous liquid column extends above the viewed level.

Water uses the installed `UNDERWATER_1` through `UNDERWATER_7` tiles, with 72%
opacity and depth testing. Magma uses the corresponding `UNDERMAGMA_*` tiles.
Both use ordinary textured materials; there is no custom liquid shader.
Creature sprites use alpha-tested opaque depth writes, including composed dwarf
appearance layers, so water behind a creature cannot paint across its body.
Transparent sprite pixels still reveal water, and water in front still blends.

Creatures, composed dwarf appearances and plant billboards measure transparent
bottom padding from their actual image pixels, using the same alpha cutoff as
rendering. The lowest rendered pixel anchors to the sampled floor/ramp height.
Plant quads shift in local billboard space, preserving contact when looking down
or up. Measurements are cached rather than reading image pixels every frame.

## Trees and critic review

Actual revealed DF tree cells determine the occupied 3D body. Adjacent trunk cells
join across block boundaries; directional branches reach the correct tile edges.
Only twig cells receive leaf lobes. Dead branches remain bare. Species-specific
native graphics provide trunk cuts, side bark, foliage and mushroom-cap surfaces.
Species-specific alternatives are exhausted before generic artwork is considered.
Rooted trunks borrow visible neighbouring ground textures instead of leaving a
hole around the narrower 3D stem. Airborne branches do not acquire ground slabs.

The shared terrain window covers five levels below and ten above the camera cut
throughout the requested XY footprint, within the 4096-block resident budget.
Camera-adjacent columns load first. Orbit mode keeps its cutaway; first person
renders the loaded upper tree body.

A requested independent critic reviewed actual surface-tree geometry at
X48–63/Y64–79, including plum, peach and almond trees, against the installed native
tile graphics at the same coordinates. Ratings improved from 3.6 to 4.25 to
**4.5/5 asset/shape fidelity** after removing leaves from bare branches, adding
irregular stepped canopy lobes and matching their texel scale to bark.

A separate, explicitly controlled tower-cap/fungiwood fixture reached **4.3/5**.
It caught and corrected a generic bark fallback and an invalid fixture that had
given branching fungiwood a tower-cap shape. Tower caps preserve their pale stems
and native brown cap tokens; fungiwood preserves yellow/orange branching growth.
Remaining differences are simplified branch taper, voxel-stepped silhouettes,
rectangular cap undersides and simplified fungal nodules. These are comparisons
against token-specific game artwork, not matched native-camera scene ratings.

## Smoke, mist and fire

Map-block field 30 supplies live effect kind, position, density and dead status.
Only effects positioned within a revealed tile of their owning chunk are sent.
Smoke, mist, steam, fire and related native flow types use the installed four-frame
`FLOW_*` artwork on moving camera-facing particles. Density controls particle
count and scale. Dead or removed effects disappear on the next chunk snapshot.
Two reusable draw batches cap allocation at 1536 particles each; there are no
per-particle meshes or dynamic lights. Empty batches do not render or upload.

The native sprite/motion demonstration used controlled fixtures, not newly created
in-game fires or smoke. No game objects, saves or designations were modified.

## Verification

Tests cover liquid wire fields and all seven fill heights, hidden-data redaction,
water texture/material selection, seam culling, connected tree topology, rooted
ground, canopy retention, flow decoding, stale-effect removal and sprite depth.
Browser checks verified native textures, animated flow positions, absence of page
errors, and actual surface-tree metadata. A WebGL pixel check verified foreground
sprite / water-behind / transparent-hole / submerged-sprite compositing.
The final live grounding check covered two visible creatures and 167 anchored
plants, with zero measured ground/anchor error and no page errors. All 139 tests
pass, including explicit padding-alpha and ramp-grounding regression cases.
