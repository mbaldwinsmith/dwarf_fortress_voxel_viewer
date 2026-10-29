# dwarf_fortress_voxel_viewer

Dwarf Fortress Voxel Viewer

Deepwatch is a local, read-only WebGL companion. This first milestone renders
actual terrain from a running fortress, polls changes and supports orbit, pan,
zoom, Z cutaways and tile inspection. It does not issue gameplay commands.

## Windows app

Use the **Deepwatch Setup** installer, or extract the portable **Deepwatch ZIP**
and run `Deepwatch.exe` from the extracted folder. Node.js and a dev server are
not needed on the viewer PC. Dwarf Fortress and DFHack must still be installed
and running with a fortress loaded.

The app finds the standard Steam installation, or asks you to choose the folder
containing `Dwarf Fortress.exe`. **File > Choose Dwarf Fortress folder** changes
and remembers that choice. Cancelling opens the viewer without local artwork;
you can choose the folder later. **File > Restart companion** retries startup,
and **Help > Open log folder** opens diagnostics. Closing the app stops its
companion. Game files and saves stay read-only.

Current Windows packages are unsigned; Windows may display an unrecognized-app
warning. The installer is per-user and does not request administrator privileges.

### Build Windows packages

Requires Windows x64 and Node.js **22.12+** (Node 24 is used by CI):

```powershell
npm ci
npm run dist:win
```

The `release/` folder contains `Deepwatch-Setup-0.1.0-x64.exe`,
`Deepwatch-0.1.0-x64.zip` and `SHA256SUMS.txt` (names follow `package.json`'s
version). `npm run pack:win` produces an unpacked app for testing;
`npm run desktop` builds and runs the desktop app from source.
`npm run desktop:smoke` checks startup, WebGL, renderer isolation and connection
to the bundled companion, then exits.

### Build releases on GitHub

Run **Actions > Windows app > Run workflow** to download tested packages as a
workflow artifact. To prepare a GitHub Release, push a `v` tag matching the
version in `package.json`, for example `v0.1.0` for the initial package. The
workflow builds and smoke-tests the packaged executable, uploads the installer,
ZIP and checksums, and creates a **draft** release for you to review and publish.
No signing credentials or release token beyond GitHub's built-in token are required.
No game installation, saves, local configuration or proprietary game images are
included in the app or release artifacts.

## Run

Requires Node.js 22.12+ and DF 53.16 with DFHack 53.16-r3 / RemoteFortressReader
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
the manual Z slider. Both modes load five levels around the cutaway and are shared by all open
viewer tabs. Switching resets terrain to avoid mixing regions.

## Controls

- Left-drag: orbit. Right-drag: pan. Wheel: zoom.
- Cutaway slider or `[` / `]`: change the highest visible Z-level.
- Frame terrain or `F`: reset camera and frame the local map.
- Click terrain: inspect tile below the viewer. Hidden tiles stay undiscovered.
- Touch: one finger orbits; two fingers pan and zoom.
- **1st person**: switches to Whole map and shows a glowing camera-point selector.
  Click a green floor tile to enter; red means blocked or awaiting terrain/roof data.
  Use WASD to walk and the mouse to look. Escape releases the mouse and pauses movement;
  click the viewport to resume. **Orbit view** returns to the previous camera,
  and **Choose another point** lets you relocate.

Routine terrain changes preserve the camera. Changing Z keeps horizontal camera
position and shifts its height with the cutaway. All open viewer tabs share one
cutaway; the latest level selection wins. Five levels are resident, so this
is full-footprint exploration, not a simultaneous 199-level volume.
First-person ramps follow the rendered slope into upper/lower landings. On a
connected stair tile, hold W to climb or S to descend. The camera and streamed
levels follow automatically; missing, hidden and disconnected destinations block
travel. Furniture/door collision is not implemented. Manual Z changes and unrelated
reconnections return to camera-point selection.
First person renders the loaded levels above and below you, including upper walls
and landings. Stair shafts have open centres so you can look between levels.
Clicking the view focuses its keyboard controls even when an embedded browser
blocks pointer lock. In that fallback, keep the pointer over the view to look.
Escape pauses; click again to resume. The banner reports active/paused controls.

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

The screenshot-led texture review reached an independent critic score of 4.53/5.
Terrain preserves the authored premium-art palette instead of multiplying physical
material RGB into already-coloured floors. Native ore/crystal borders, stair
sprites and grass tile variants improve agreement with DF. Material names remain
available in inspection. Bed sheet/pillow layers use stable approximate styles
because RFR omits the game's graphic seed. See docs/texture-fidelity-review.md.

Loose ground items now use installed item artwork, including material-specific
boulders, rough gems, logs, bars, containers and supported equipment. Only revealed
on-ground items are streamed; carried items, container contents, installed building
components, hidden/encased/deleted items and projectiles are excluded. One stable
item sprite is shown per occupied tile, with authoritative replacement on each
terrain update. Unsupported item artwork is omitted. Native inorganic material
palettes recolour boulders and installed tables/thrones without losing shading.
