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

Actual revealed DF tree cells determine the occupied 3D body. Connected trunk
sections have rounded outlines, tapered transitions and closed undersides.
Concave sections retain their empty notches and unknown interior cells. Sloping
trunk tiles form thick bends into the crown. Native directional branches retain
their arms; unspecified twigs form a connected hierarchy instead of a grid.

Only actual leafy twig cells receive irregular, rotated leaf volumes, with small
shoulders joining adjacent leafy cells. Dead branches stay bare. Native-empty
glumprong and blood-thorn twig states remain empty. Spore trees have teal nodules,
fungiwood retains orange/yellow terminals, saguaro tips are green and domed, and
tunnel tubes have hollow mouths with the native red annulus.

Native species artwork supplies bark, foliage and exposed sections. Longitudinal
bark patches repeat at stable texel scale; hollow and pith-bearing sections use
their outer tissue for side walls. The bridge supplies the raw species ID along
with its display name. Rooted trunks borrow visible neighbouring ground textures;
airborne branches do not acquire ground slabs. No artwork or QA images are bundled.

The shared terrain window covers five levels below and ten above the camera cut
throughout the requested XY footprint, within the 4096-block resident budget.
Camera-adjacent columns load first. Orbit mode keeps its cutaway; first person
renders the loaded upper tree body.

The requested specialist Tree Critic independently reviewed 17 native adult
families, four state/topology fixtures, a frozen 144-block live grove containing
eight species, and the previously approved tower-cap top/side/underside views.
After nine visual iterations and a final worker-path comparison, **every case
scores at least 4.80/5; pine, cedar and larch score 4.85**. Detailed component
scores, native crop findings and round-by-round corrections are in
[tree-critic-review.md](tree-critic-review.md). Earlier 4.5 surface-tree and 4.3
fungal checkpoints are historical; the separate cap refinement is documented in
[fungi-cap-review.md](fungi-cap-review.md).

Tree meshes now build in a dedicated worker. Requests coalesce, stale results
are discarded, nearby work takes priority, and a 32 MiB geometry-buffer cache
reuses completed meshes. Atlas coordinates are resolved after worker completion.
Existing trees remain visible during replacement. Cap and tree children update
independently, and both queues clear on reset/disposal. The frozen live audit
measured 3.6 ms p95 / 12.2 ms maximum main-thread request cost, 19 completed tree
meshes, finite geometry and a cache hit without another build. These are local
measurements, not a general frame-rate guarantee.

Final ignored evidence is in `artifacts/tree-review-runtime10/`; its controlled
render panels and actual grove differ only by negligible rounding pixels from
the approved synchronous round. Remaining small faceted limbs and clumped native
occupancy layers are deliberate limits of this pixel-art voxel interpretation.

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
