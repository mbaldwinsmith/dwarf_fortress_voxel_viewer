# Workshop models

The viewer has 33 explicit vanilla layouts: 25 workshops, seven furnace variants
and the trade depot. The reference artwork is the installation's `workshops.png`,
`workshops_1x1.png` and `workshops_5x5.png`, resolved through their native raw tokens.
No DF images are included in the application or repository.

| Family                    | Profiles                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Benches and crafts        | Carpenter, mason, craftsdwarf, jeweler, bowyer                                             |
| Metalworking              | Metalsmith forge, magma forge, mechanic                                                    |
| Animal products and cloth | Butcher, leatherworker, tanner, clothier, fishery, loom                                    |
| Food and processing       | Farmer, still, kitchen, ashery, dyer, soap maker                                           |
| Small machines            | Quern, millstone, screw press                                                              |
| Large footprints          | Siege workshop, kennel, trade depot                                                        |
| Furnaces                  | Wood furnace, smelter, glass furnace, kiln, magma smelter, magma glass furnace, magma kiln |

Models interpret the native equipment silhouettes and layouts using low-poly
benches, frames, vessels, gears, anvils, hearths and machinery. Floors preserve the
native workshop mosaic and construction tint. Model parts sample native local
wood/stone/metal artwork; supported construction palettes colour the stonework.
Cloth, dyes and other small decorative details use approximate colours.

Props are a static interpretation of workshop art, not a live inventory of
supplies, tools or products. Furnaces do not claim to show active jobs or fuel
consumption; magma inlets distinguish the permanent magma variants. Unsupported
modded workshops retain the prior artwork fallback.

Every visible footprint tile owns only the geometry clipped to that tile. A
workshop crossing map blocks therefore remains continuous without depending on
an origin mesh in another block. Hidden cells produce no objects or model parts.
All equipment fits below the next z-level ceiling. The 1x1 mill graphic lookup
also handles the native shorter token format.

Full local layouts have a 96-entry cache. Clipped footprint parts are cached with
their parent layout using weak references, then translated into world positions.
They join the existing per-chunk material batches and normal disposal path.

Validation covers recipe IDs, footprint bounds and local image references. Tests
exercise every layout, hidden cells, map-block crossings, one-tile machines and
cache placement across locations and z-levels. Browser QA uses isolated mock
connections with actual installed artwork; it does not modify the fortress.
