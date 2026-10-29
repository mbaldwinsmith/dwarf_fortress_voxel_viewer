# dwarf_fortress_voxel_viewer

Dwarf Fortress Voxel Viewer

Deepwatch is a local, read-only WebGL companion. This first milestone renders
actual terrain from a running fortress, polls changes and supports orbit, pan,
zoom, Z cutaways and tile inspection. It does not issue gameplay commands.

## Run

Requires Node.js 20.15+ and DF 53.16 with DFHack 53.16-r3 / RemoteFortressReader
0.21.0. Other versions are rejected until verified. DFHack must already be
installed and its local remote server available. Load a fortress in DF.

```powershell
npm ci
Copy-Item .env.example .env
# Optionally set DF_PATH in .env to your installation directory.
npm run dev
```

Open [the development viewer](http://127.0.0.1:5173).
One command runs Vite and the bridge. The viewer streams the full local map
footprint, showing the selected Z-level and two beneath it. The slider spans
every map Z-level. Terrain arrives progressively, centre first; changing Z
cancels the old scan and starts a fresh session.

For production:

```powershell
npm run build
npm start
```

Open [the production viewer](http://127.0.0.1:4174). Stop either mode with Ctrl+C.
All generated files stay in the project. Nothing is written to DF or its saves.

## Configuration

Copy `.env.example` to the ignored `.env`. `DF_PATH` enables read-only module
inspection and reading the installation's remote-port setting. `DFHACK_PORT`
overrides that port; otherwise it defaults to 5000. `VIEWER_PORT` defaults to 4174. `POLL_MS` defaults to 200 and is clamped to a minimum of 100 ms between
individual block requests. The development viewer uses port 5173.

`npm run inspect` lists available installation module metadata when `DF_PATH` is
set. It does **not** establish the loaded world's active mod order. This milestone
uses original terrain geometry and an explicit vanilla simple-creature sprite profile.
Artwork is read locally at runtime when DF_PATH is set; nothing is bundled.

## Render view

Use the **DF screen / Whole map** radio buttons in the toolbar. DF screen follows
DF’s visible map area (rounded outward to 16-tile block boundaries) and current
Z-level; the manual cutaway slider is disabled. Viewport changes are checked
about every 12 block reads. Whole map streams the full XY footprint and enables
the manual Z slider. Both modes load three levels and are shared by all open
viewer tabs. Switching resets terrain to avoid mixing regions.

## Controls

- Left-drag: orbit. Right-drag: pan. Wheel: zoom.
- Cutaway slider or `[` / `]`: change the highest visible Z-level.
- Frame terrain or `F`: reset camera and frame the local map.
- Click terrain: inspect tile below the viewer. Hidden tiles stay undiscovered.
- Touch: one finger orbits; two fingers pan and zoom.

Routine terrain changes preserve the camera. Changing Z keeps horizontal camera
position and shifts its height with the cutaway. All open viewer tabs share one
cutaway; the latest level selection wins. Only three levels are resident, so this
is full-footprint exploration, not a simultaneous 199-level volume.

## Verify

```powershell
npm run check
npm test
npm run build
```

Tests use original synthetic data and a local mock RPC server. They never load
saves, use game artwork or issue gameplay commands. Live verification evidence
and outstanding limits are in [docs/progress.md](docs/progress.md).
Protocol and coordinate decisions are in [docs/architecture.md](docs/architecture.md).

## Troubleshooting

**Disconnected / RPC failure:** ensure DFHack is running and a fortress is loaded.
The bridge retries automatically. Check the displayed error and configured port.
It does not alter DFHack remote-access settings. `GetMapInfo` failure commonly
means no playable local map is loaded.

**Unsupported version:** the exact protocol and plugin semantics need inspection
before supporting another version. Do not bypass the version gate blindly.

**Empty region:** the sampled Z-levels may be open sky or undiscovered. Try the
cutaway to select a useful level. A black opaque region represents
undiscovered tiles, whose real shapes and materials never reach the browser.

**Changes appear slowly:** the bridge polls individual blocks conservatively;
a 192 × 192 × 3 sweep takes roughly two minutes at default settings. The
selected layer arrives first; subsequent layers follow. Render frames run independently.
No changes may be happening if the game is paused.

**WebGL unavailable:** enable a working hardware-accelerated browser. The viewer
reports renderer creation failures in its status area.

**Port occupied:** stop the other bridge/dev process. Do not run development and
production bridges on the same port. If changing `VIEWER_PORT` for development,
also update Vite's bridge proxy target.

Live creatures use camera-facing billboards and local simple sprites. Dwarves use a partial layered compositor driven by live caste, skin palette,
and worn/held inventory. Supported clothes, armour and equipment are composited
at runtime. Hair and beards follow live length, colour and grooming style, with curl variants
and headwear suppression. Faces use four stable per-dwarf vanilla variants and live iris colours.
The face selection is an artistic substitute: RFR omits the game's random face index.
Exact facial proportions, special conditions and
profession palettes remain incomplete; root-by-root greying is approximated; item/dye colours are approximate.
Unsupported creatures use markers. Directional animation frames are not implemented.
The vanilla fallback profile does not claim to reproduce active mod overrides.
Workshops and furnaces use local tiled artwork placed on the ground, as do beds and
supported furniture. Doors are upright sprites with live open/closed artwork.
Shrubs and saplings use species sprites that face the camera. Building/plant
updates arrive with the terrain sweep; the plant position cache refreshes every
five seconds. Unknown workshop art uses a neutral footprint. Construction stages,
exact furniture variants/material palettes and plant seasonal growth are approximate.
Revealed tree trunks, branches and mushroom caps now use species billboard tiles when available; unmatched tree tiles retain voxel geometry. Ramps, stairs, trees and
fortifications are approximate; liquids are omitted. No external accounts,
telemetry, uploads or cloud services are required.

Wall and floor textures use installed vanilla terrain PNGs on all exposed faces,
with rough/smoothed stone, soil, grass, ice and constructed wood families.
The shared browser atlas retains one terrain material and per-block meshes.
Terrain tints now use actual per-tile DFHack material RGB, including construction
materials, with sRGB-to-linear conversion. Native species grass artwork includes
floor fungus, cave moss and underlichen. Tile inspection shows material names.
Lighting, engraved designs and adjacency variants remain approximate; hidden
terrain and unavailable material data retain safe fallback colours.

Wall caps combine neighbour-aware native wall edges/corners with dark hidden-rock
interiors. All eight neighbours determine the directional tiles; enclosed fill
variants remain independent of ore.
Enclosed natural walls are sent as generic solid rock, including their inspection
labels; material colours remain on exposed faces. Missing neighbour blocks are
treated conservatively until a later sweep confirms exposure.
