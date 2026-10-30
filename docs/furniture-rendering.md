# Furniture meshes

Installed tables, chairs/thrones and beds carry explicit furniture metadata from
the companion and render as small 3D models in all views. Loose furniture items
remain ground sprites. Unknown tiles never expose furniture.

Tables have a raised top and four legs. Wooden chairs have a seat, back, legs and
stretchers; stone thrones have thicker supports and arms. Beds have a frame,
headboard, footboard, mattress, blanket and pillow. Models fit inside one tile and
below the next ceiling, and rest on the local terrain surface.

Opaque interior regions of the native artwork texture the frame surfaces, with
the existing material palettes. Simple directional face shading makes the shape
read clearly in the unlit sprite renderer. Raised bedding volumes remain opaque
beneath the native sheet and pillow details. Bedding variants retain the existing
stable approximation, since the remote protocol omits the game's graphic seed.

Faces join the existing per-chunk material batches instead of adding a draw call
for every furniture item. Rebuilds replace and dispose geometry normally; view
cutoffs and chunk pruning also apply to the models. These shapes are viewer-side
interpretations of the native 2D furniture art, not meshes supplied by DF.
