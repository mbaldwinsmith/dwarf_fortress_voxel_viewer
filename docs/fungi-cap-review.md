# Curved fungal caps and round stalks

Caps now use a joined, rounded extrusion of the revealed DF cap columns. A
continuous surface replaces per-tile boxes and internal panels. Native
`TREE_CAP_THICK_INTERIOR` artwork covers the crown and sides, including the
previous flat brown centre. World-anchored, mirrored triplanar texture mapping
keeps the pattern continuous around curves and across chunk boundaries. The
closed underside blends finer native stalk/interior texture into the rim.

Mushroom stalks extrude the native circular pillar cross-section, with rounded
elliptical sections for broad rectangular trunks. Their upper sections extend
inside the cap, bounded by its thickness, to close the attachment. Exposed stalk
tops use the native top artwork. Ordinary woody tree geometry is unchanged.

The cap mesher runs in a Web Worker. Pending work for a chunk is coalesced, stale
results are discarded after updates/reset, and geometry is transferred back in
typed buffers. Cap geometry is disposed alongside its terrain parent. Native
tile occupancy remains authoritative; curvature and underside appearance are
3D interpretations rather than extra geometry supplied by DF.

## Critic review

A separate fungi critic reviewed top, side and underside viewer captures made
from a read-only snapshot of actual tower-cap tiles (X 88–90, Y 70–72,
Z 128–130). The native U-shaped footprint was deliberately retained.

- First iteration: **4.6/5**. Panels and matte centre fixed, but the underside
  formed a broad white rim, its texture scale was too coarse, and column joins
  left pronounced crown grooves.
- Second iteration: **4.8/5 — pass**. Narrower underside transition, finer
  texture and smoother joins resolved those issues.
- Final cap and round stalk: **4.8/5 — pass**. No visible cap gaps, stalk/cap air
  gap, square stalk corners or texture-reset strip at the joint. Minor native
  tile-derived crown humps remain.

Geometry checks cover closed thin caps, horizontal and vertical chunk seams,
closed cutaways, hidden tiles, separate cap layers, native stalk textures, broad
stalk joins and bounded penetration into thin caps. Worker tests check stale
result rejection and coalescing. Browser captures completed without errors.
