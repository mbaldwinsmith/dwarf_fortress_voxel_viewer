# Texture fidelity review — 29 October 2026

The user requested an independent critic and iteration until texture fidelity reached 4.5/5. A read-only critic agent used one fixed rubric throughout. The final reviewed result scored **4.53/5**.

## Review method

- Reference: the user's 891 × 555 Dwarf Fortress screenshot.
- Comparison: real read-only snapshots of the same loaded fortress at Z128, rendered through the viewer's normal scene and texture code.
- Registration: an orthographic inspection view, approximately 24 pixels per tile, with crop origin X26.375/Y117.333. Stair and hall landmarks establish the alignment.
- Source artwork comes from the installed vanilla modules. No reference-image pixels were inserted into the renderer. Screenshots remain local artifacts outside Git.
- The critic assessed textures separately from intentional 3D geometry, moved units, and missing loose-item coverage.

## Scores

| Category                          |   Weight |  Baseline |    Pass 1 |    Final |
| --------------------------------- | -------: | --------: | --------: | -------: |
| Floors and base terrain           |      35% |       1.2 |       4.7 |      4.8 |
| Wall caps and mineral borders     |      30% |       2.6 |       3.9 |      4.7 |
| Cavern vegetation and transitions |      15% |       3.8 |       4.0 |      4.6 |
| Furniture, workshops and doors    |      15% |       2.4 |       2.8 |      3.4 |
| Pixel sampling and palette        |       5% |       3.3 |       4.4 |      4.8 |
| **Weighted total**                | **100%** | **2.295** | **4.055** | **4.53** |

## Corrections

The installed stone-floor artwork already contains the reference's blue-grey palette. Multiplying physical material colour into it caused brown, cyan and purple patches. Preserving authored floor RGB and removing terrain-light colour shifts fixed the dominant mismatch. Uniform native charcoal interiors replaced repeated cap flecks; directional cap outlines remain native texture tiles.

Vanilla raw flags now distinguish ordinary vein stone, metal ores and gems. This preserves gold mica borders, pale pink-white ore borders and separate crystal shapes. Native grass variants and stair sprites restore their corresponding patterns. Workshop base material tint is separate from machinery overlays. Native sheet and pillow layers make bedding read correctly as bedding.

## Residual differences

- Bed-cover colours and individual styles are stable substitutes. RFR does not expose the game's graphic seed, so some reference green/white/pink covers differ at the same locations.
- Some grass-edge transitions and mineral border hues remain approximate.
- Loose boulders/items are not yet rendered. Unit positions can change between captures.
- Doors remain upright as requested earlier; they appear edge-on from the top-down inspection view.

The score is for texture fidelity, not pixel-identical or complete scene reproduction.
