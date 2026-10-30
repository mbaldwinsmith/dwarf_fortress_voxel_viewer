# Furniture meshes

Installed tables, chairs/thrones, beds, cabinets, coffins, bookcases and chests carry explicit furniture metadata from
the companion and render as small 3D models in all views. Loose furniture items
remain ground sprites. Unknown tiles never expose furniture.

Tables have a raised top and four legs. Chairs and thrones are compact backless
seats with a symmetric footprint; wooden seats have legs and stone seats use a
solid pedestal. Beds have a frame,
headboard, footboard, mattress, blanket and pillow. Models fit inside one tile and
below the next ceiling, and rest on the local terrain surface.

Cabinets have raised double doors and native handles. Bookcases have real
recessed shelves with native book details at the back. Those details are native
artwork, not a live inventory of stored books. Coffins have a closed tapered
outline with continuous lid UVs. Chests have an overhanging lid and a front latch.
Bookcase material variants are read from their native `TOOL_GRAPHICS` definitions.

Barrels, bins, buckets and large pots on the ground now use hollow 3D shells,
including barrel hoops, bucket handles and pot rims. Their normal item updates
control movement and disappearance. Contained, carried, installed and hidden
items remain filtered before modelling. Metal artwork is selected from native
material flags rather than treating every inorganic material as stone.

Cages and animal traps use actual bars and open interiors. Weapon racks and armor
stands have separate supports and beams. Nest boxes have shallow walls and native
straw; hives have rounded, ringed profiles and entrances. These models show the
structure only: no inferred stored contents, mounted equipment, eggs or captive
animals are fabricated. Hive buildings use the native installed-hive artwork.

Doors, hatches, floodgates and floor/wall grates use RemoteFortressReader's
`active` flag (`1` closed, `0` open). Doors swing beside their frames, hatches lift,
and open grates/floodgates retract to their frames. Closed solid panels have opaque
cores beneath native texture details; grates have separate bars and real gaps.
Hatches and floor grates can render over revealed open shafts. Wall orientation
is inferred from neighboring rock; hinge placement is a viewer interpretation.

The nearby item poll also refreshes the region-wide building records carried on
RFR's first partial block, without replacing cached terrain or postponing its
refresh. This publishes state changes and building removals during normal nearby
polling instead of waiting for the full terrain sweep. Missing responses retain
the prior buildings. No game mutation is needed to read these states.

Opaque interior regions of the native artwork texture the frame surfaces, with
the existing material palettes. Simple directional face shading makes the shape
read clearly in the unlit sprite renderer. Raised bedding volumes remain opaque
beneath the native sheet and pillow details. Bedding variants retain the existing
stable approximation, since the remote protocol omits the game's graphic seed.

Faces join the existing per-chunk material batches instead of adding a draw call
for every furniture item. Rebuilds replace and dispose geometry normally; view
cutoffs and chunk pruning also apply to the models. These shapes are viewer-side
interpretations of the native 2D furniture art, not meshes supplied by DF.
