# Creature artwork coverage

The explicit installed vanilla profile supports native living layer sets for
203 race/caste profiles (198 species), plus flat sprites and multi-tile images.
Graphics remain local to the user's DF installation. Portrait, statue and corpse
sets are excluded from living-unit selection.

| Group                                       | Support                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Dwarves, humans, elves, goblins and kobolds | Body, skin palettes, faces, eyes, hair/beards, clothing, armour, weapons, shields and tools                                             |
| Animal people and underground peoples       | Expanded native templates, permitted body parts, species/caste anatomy, clothing, armour, weapons and shields with native pixel offsets |
| Ogres and trolls                            | Native body/size variants, supported wielded equipment, and hauled supplies                                                             |
| Pack animals                                | Adult/young body sprites; pack-bag layers remain outside the sentient layer evaluator                                                   |
| Large/giant animals and megabeasts          | Native multi-tile sprites with preserved scale and aspect ratio                                                                         |
| Small/vermin graphics                       | Artwork definitions available; separate vermin/swarm entities are not streamed by the unit reader                                       |

## Live appearance and equipment

The same evaluator now serves every compatible humanoid. It reads the unit's
caste, skin/hair colours, hair style, inventory attachment and mode, profession,
body size, item material/dye, artifact status and grown-item flag. Native layer
groups retain their order and alternative selection. Hand-specific rules match
the actual attachment; WIELD matches wielded items and ANY_HAULED matches
hauled inventory. Material rules distinguish ordinary wood, grown wood and
inorganic equipment. Native profession inheritance selects clothing palettes.
The pinned profession metadata comes from df-structures d8ff8a63.

Animal-person templates expand their declared ARG values, permitted limbs and
pixel offsets. Weapon and body rectangles share an anchored canvas that includes
left/right/up/down offsets without clipping. Vanilla humanoid clothes palette
files are byte-identical; template profiles without a local clothes palette use
that shared definition.

Native profession status selects baby/child/adult sets across species, avoiding
the dwarf maturation age for non-dwarves. A missing dedicated life-stage set
falls back to its native default. Flat pack-animal juvenile selection still uses
the existing under-one age rule. Creature animation playback is not implemented.

Equipment/appearance changes replace composites on live snapshots. The cache
retains only currently used appearances and supports the protocol's 2000 active
units, replacing the previous permanent 256-appearance limit. Obsolete pending
compositions cannot resurrect disposed textures.

## Fidelity limits and verification

Only equipment for which the installed creature set supplies a native layer is
drawn. Unsupported/unknown conditions fail closed. RFR does not expose random
body-part indices or syndrome classes: random parts use stable per-unit artistic
variants; syndrome-specific overrides cannot be selected from unavailable data.
Ghost state is supported through the exposed native flag. Active mod override
precedence is still unresolved; this is the explicit vanilla profile.

The native-data audit evaluates all 203 compatible profiles and produces a
nonempty composite for each. A WebGL lineup verifies 24 bare/equipped native
composites across twelve representative profiles, including offset weapons,
without page errors or sprite-loading warnings. Regression tests cover template
expansion, offsets, hand selection, wielding, material/size/haul rules, life stages,
non-dwarf live-inventory conversion and cache cleanup beyond 256 appearances.
The loaded fortress stream retained native artwork for all 20 visible creatures;
non-dwarf humanoids were verified using native-art fixtures and reader fixtures.
