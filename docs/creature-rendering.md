# Creature artwork coverage

The explicit installed vanilla graphics profile supports flat living sprites,
multi-tile `LARGE_IMAGE` rectangles, caste-specific sprites and conservative
`BODY`/`CBODY` extraction from layered default sets. A native `ANIMATED` frame
can supply a static fallback when no flat default sprite exists. Corpse,
portrait, statue and list-icon artwork is excluded from living-unit selection.

The 2026-10-30 audit increased loaded sprite references from 204 to 1028. These
are artwork keys, including caste and juvenile variants, not a species count.
Both live two-humped camels resolved correctly in the loaded fortress; its
20 streamed creatures all had native sprites or dwarf composite layers.

| Group                                               | Support                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Dwarves                                             | Clothing/equipment and appearance layers, including hair and faces                                                 |
| Pack animals                                        | Adult/young body sprites for camels, donkeys, horses, mules, water buffalo, yaks, unicorns, elephants and muskoxen |
| Large/giant animals and megabeasts                  | Native multi-tile rectangles with preserved scale and aspect ratio                                                 |
| Animal people and trolls                            | Native static living animation-frame fallback; no full equipment/body-layer evaluation                             |
| Humans, elves, goblins, kobolds and both ogre types | Complex layered sets still unsupported; marker fallback                                                            |
| Small/vermin graphics                               | Artwork definitions available; separate vermin/swarm entities are not streamed by the current unit reader          |

Pack-animal body extraction accepts only the explicit child/not-child rule and
does not guess among palette, equipment, syndrome or other conditional layers.
Pack bags are not composited. Existing age-under-one juvenile selection is
retained; species-specific maturation ages are not exposed by the current
reader. Creature animation playback is not implemented.

Verification includes parser regressions for both camel species, multiple pack
animals, large rectangles, living-frame priorities and exclusion of nonliving
art. A WebGL fixture loaded all eleven selected native animal sprites, including
camels, deer, elephants, giant camels and dragons, without browser errors.
