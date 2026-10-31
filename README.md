# Deepwatch

**A live 3D voxel viewer for Dwarf Fortress.**

Explore your fortress from another perspective. **Deepwatch** connects to a running
game through DFHack and renders its terrain, creatures and furnishings in WebGL.
Orbit above an excavation, cut through the mountain, or step into the halls in
first person.

Deepwatch runs locally and reads artwork from your own Dwarf Fortress installation.
Exploration starts in Inspect mode. Optional digging and designation tools apply
single-tile actions to the loaded fortress through DFHack.

> **Early development:** currently supports **Dwarf Fortress 53.16**,
> **DFHack 53.16-r3** and **RemoteFortressReader 0.21.0**. Other version
> combinations are rejected until verified.

## Features

- **Live fortress terrain:** progressively loaded walls, floors, ramps, stairs
  and excavations, with updates while the game runs.
- **Prioritised streaming:** batched vertical columns, nearby walking terrain
  first, and a reserve cache for returning between levels. Creatures target
  250 ms polls; nearby ground items target 1 s polls independently of terrain.
  Actual update intervals depend on DFHack and rendering load.
- **Resource-conscious rendering:** shared tile palettes, compact indexed geometry,
  bounded caches and reduced rendering work while the scene is still. See the
  [performance measurements](docs/performance-review.md).
- **Orbit and cutaway views:** pan, zoom and inspect tiles across the map's
  Z-levels, or follow the area currently visible in DF.
- **First-person exploration:** choose a starting point and walk through revealed
  terrain, including connected stairs and ramps.
- **Mining tools:** click to excavate or designate in Orbit/DF Screen. In first
  person, hold left mouse for 0.75 seconds to dig, with flashing native pick/spade
  icons, or click in Designation mode to give your dwarves a mining job.
- **Authentic local artwork:** installed vanilla terrain textures, creature
  sprites, workshops, furniture, plants and supported ground items.
- **Creature sizes:** raw-derived current body volumes drive logarithmic sprite
  scaling, including growth. An adult dwarf is the reference; display multipliers
  stay between 0.35 and 3. Clothing/equipment scale together and feet stay grounded.
  Solid overhead terrain caps visible sprite height, even when cut away; creatures
  smoothly return to their natural size outside. Transparent padding is excluded.
- **Layered peoples:** native body, clothing, armour, held weapons and shields
  for dwarves, humans, elves, goblins, kobolds, ogres, trolls and compatible
  animal/underground peoples, with appearance drawn from live game data.
- **Water and magma:** native game textures on volumes filled from 1/7 to 7/7,
  with translucent water and depth-correct creature sprites.
- **3D trees:** connected trunks, directional branches, species-specific foliage
  and giant fungi, with nearby upper crowns streamed for first-person views.
  Giant fungal caps have continuous curved skins, textured undersides and round
  stalks joined into the cap. Cap meshing runs in a background worker; see the
  [fungi critic review](docs/fungi-cap-review.md).
- **Physical projectiles:** arrows, bolts, thrown items, ballista ammunition and
  catapult stones, with native artwork, flight orientation and interpolation
  between observed positions. Projectile polls target 75 ms; short flights
  entirely between polls may be missed.
- **Atmospheric effects:** animated native smoke, mist, steam and fire sprites
  driven by visible DFHack flow data. Plants and creatures anchor their lowest
  visible pixels to floors and ramps.
- **Windows desktop app:** a local companion and WebGL viewer in one application,
  with installer and portable ZIP build targets.

This is a companion viewer. Continue playing and controlling your fortress in
Dwarf Fortress; first-person movement moves only Deepwatch's camera.

## Getting started on Windows

### Requirements

- Windows x64 for the packaged desktop app.
- The supported DF, DFHack and RemoteFortressReader versions listed above.
- DFHack's local remote server available, with a fortress loaded.
- Working hardware-accelerated WebGL.

DFHack must already be installed. Deepwatch does not install it or change its
remote-access settings.

### Desktop app

When a package is available, get it from
[Releases](https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer/releases),
or download a build artifact from the
[Windows app workflow](https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer/actions/workflows/windows-release.yml).
See [Building Windows packages](#building-windows-packages) to build it yourself.

1. Run the **Deepwatch Setup** installer, or extract the portable **Deepwatch ZIP**
   and run `Deepwatch.exe` from the extracted folder.
2. Start Dwarf Fortress with DFHack and load your fortress.
3. Open Deepwatch. It looks for the standard Steam installation; if necessary,
   choose the folder containing `Dwarf Fortress.exe`.
4. Allow terrain to load, then orbit the map or choose **1st person**.

A typical Steam installation is:

```text
C:\Program Files (x86)\Steam\steamapps\common\Dwarf Fortress
```

Node.js and a development server are **not required** to use a packaged app.

The app remembers your selected installation. Use **File → Choose Dwarf Fortress
folder…** to change it, **File → Restart companion** to retry startup, and
**Help → Open log folder** for diagnostics. If you cancel folder selection,
the viewer can connect without local artwork.

Closing the app stops its companion. The installer is per-user and does not
request administrator privileges. Packages are currently unsigned, so Windows
may display an unrecognized-app warning.

## Exploring your fortress

### View modes

| Mode           | Behaviour                                                                         |
| -------------- | --------------------------------------------------------------------------------- |
| **Whole map**  | Loads the local map's full XY footprint and enables the manual Z-level slider.    |
| **DF screen**  | Follows DF's visible map area; shortcuts or the slider can override the viewed Z. |
| **1st person** | Switches to Whole map and lets you choose a walkable camera starting point.       |

Deepwatch streams **five Z-levels below and ten above** the selected level,
plus the selected level itself (16 total), clipped to map bounds. Nearby columns
load first; first-person level changes prioritise the camera's neighbourhood.
In DF Screen mode, changing DF's own Z-level resumes following that elevation.

Orbit view hides geometry above the selected cutaway. First person displays the
loaded upper levels too, so ceilings, stair shafts and upper landings remain
visible. The entire vertical map is not loaded at once.

All tabs connected to the same companion share the view mode and selected
Z-level. The latest selection applies to everyone.

### Orbit and DF Screen controls

| Action               | Control                                          |
| -------------------- | ------------------------------------------------ |
| Rotate               | Q/E or right-drag                                |
| Pan                  | WASD or left-drag                                |
| Zoom                 | Mouse wheel                                      |
| Go up / down a level | `Shift+,` (`<`) / `Shift+.` (`>`), or the slider |
| Frame terrain        | **Frame terrain** or `F`                         |
| Inspect a tile       | Click terrain; details appear below the viewer   |
| Touch navigation     | One finger to orbit; two fingers to pan and zoom |

Routine updates preserve the camera. In orbit view, changing Z preserves its
horizontal position and shifts its height with the cutaway.

### First-person controls

Walk off a revealed edge to fall onto the ground below; no ramp or stair key is
required. Deep falls advance the streamed z-level window as you descend, waiting
at unloaded or undiscovered terrain instead of falling through it.

Select **1st person**, then click a green floor selector to enter. Red indicates
a blocked location or terrain/headroom data that has not yet loaded.

| Action                           | Control                           |
| -------------------------------- | --------------------------------- |
| Walk / strafe                    | `W`, `A`, `S`, `D`                |
| Look around                      | Mouse                             |
| Ascend connected stairs          | `Shift+,` (`<`) on the stair tile |
| Descend connected stairs         | `Shift+.` (`>`) on the stair tile |
| Pause and release mouse capture  | `Esc`                             |
| Resume                           | Click the viewport                |
| Relocate                         | **Choose another point**          |
| Return to the saved orbit camera | **Orbit view**                    |

Ramps follow the rendered slope. The camera and streamed Z-levels follow
successful stair and ramp transitions. Movement waits when destination data is
missing; hidden, disconnected or blocked destinations cannot be entered.

If mouse capture is unavailable, keep the pointer over the viewport to look
around. Click the view to focus keyboard controls. The on-screen banner reports
whether controls are active or paused.

Manual Z changes and unrelated reconnections return to starting-point selection.
Furniture and doors do not currently block camera movement.

### Digging and designation

Choose an **Interaction** tool:

- **Inspect** keeps the usual tile inspection controls.
- **Digging** excavates natural terrain directly. Click in Orbit or DF Screen;
  in first person aim within five tiles and hold left mouse for 0.75 seconds.
  Releasing, changing targets, pausing or leaving the view cancels the hold.
- **Designation** marks normal mining jobs for dwarves. In Orbit or DF Screen,
  left-drag a rectangle and release to apply; right-drag rotates and WASD pans.
  Rectangles stay on the starting z-level and skip incompatible tiles (maximum
  1024 tiles, 64 per side). In first person, click a single tile.

A wall uses the native pick icon. Aiming down at a floor channels it with the
spade icon. Ramps use the pick icon and **Remove ramp**: digging flattens them
to floors, and designation mode queues ramp removal. Ramps inside channeling
rectangles are also removed without channeling beneath them.
Stairs use **Remove stairs** with the pick: up stairs become floors, and up/down
stairs become down stairs. Down-only stairs cannot be filled by digging; build
a floor to close that opening. Rectangle designations use the same rules.
Aiming up uses the pick icon and channels the targeted ceiling tile
to open it completely. Channeling can expose lower ground; the first-person
camera settles onto a loaded walkable surface below. Native designation icons
remain visible on the map until the game clears them. Escape selects Inspect.

After a dig, the edited column and its adjacent z-levels stream immediately,
before the surrounding ring finishes refreshing. These meshes take priority
over background rebuilds; the first-person digging countdown remains 0.75 seconds.

These tools change the real loaded fortress. Trees, constructions, buildings,
hidden tiles and map edges are excluded. Instant digging uses DFHack dig-now
with standard item generation and awards no mining experience. Supported use is
natural walls and floors; there are no tree-felling or construction-removal tools.

## Local graphics and fidelity

Deepwatch supplies its own geometry and reads supported vanilla graphics from
your installation at runtime. Proprietary game images and saves are not included
in the repository or application packages.

The current graphics profile is explicitly **vanilla**. Installation inspection
can list available modules, but does not resolve the loaded world's active mod
order or graphics overrides.

| Element                 | Current representation                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terrain                 | Generated 3D geometry with installed wall/floor artwork, native edge variants and material information.                                                                                                                                                                                   |
| Dwarves                 | Camera-facing sprites with a partial layered appearance compositor.                                                                                                                                                                                                                       |
| Other creatures         | Supported local sprites; markers for unsupported creatures.                                                                                                                                                                                                                               |
| Workshops and furniture | 33 vanilla workshop/furnace/depot layouts use 3D structures with artwork loaded from your local installation; 23 furniture families use 3D models, statues combine pedestals with upright sprites, and display furniture shows confirmed item sprites. Barriers follow open/closed state. |
| Vegetation              | Species sprites for supported plants and tree parts; fallback geometry where needed.                                                                                                                                                                                                      |
| Ground items            | One supported item per occupied tile; containers use 3D models and corpses use native species artwork where supported.                                                                                                                                                                    |

Hidden tiles remain opaque and undiscovered. Their actual shapes, materials and
names are removed before data reaches the viewer. Enclosed natural rock is also
masked conservatively.

### Current limitations

- **Updates are polled, not instantaneous.** Large footprints can take minutes
  to refresh fully. Creatures are polled separately from terrain and scenery.
- **Water and magma are not rendered.**
- Ramps, stairs, trees and fortifications are visual approximations.
- Creature animation, exact facial proportions, some appearance conditions and
  profession palettes are incomplete. Some colours and graphic variants are
  approximated where the remote API omits the game's selection data.
- Furniture variants, construction stages, seasonal plant growth, lighting and
  engravings are not reproduced exactly.
- Only supported item artwork is displayed. Carried items, ordinary container
  contents, installed components and hidden items are excluded. Confirmed display
  contents use scaled native sprites; physical projectiles use their separate stream.
- Statue subjects use native covered-statue artwork when the remote API does not
  identify the depicted subject. See [furniture rendering](docs/furniture-rendering.md).
- The stream is bounded to **4,096 resident map blocks**; larger requested
  footprints are rejected.

## Running from source

Requires **Node.js 22.12 or later**. Windows is the current desktop packaging
target; installation inspection expects a Windows DF installation.

Clone the repository and install dependencies:

```powershell
git clone https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer.git
cd dwarf_fortress_voxel_viewer
npm ci
Copy-Item .env.example .env
```

Edit `.env` to set `DF_PATH` if you want local artwork, then load a fortress
with DFHack running.

### Browser development

```powershell
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).
This command runs both Vite and the companion.

### Production browser build

```powershell
npm run build
npm start
```

Open [http://127.0.0.1:4174](http://127.0.0.1:4174).
Stop the browser-mode servers with Ctrl+C.

### Desktop development

```powershell
npm run desktop
```

This builds the project and opens the Electron app.

### Configuration

Local `.env` files are ignored by Git.

| Variable      | Purpose                                                                    | Default                                               |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `DF_PATH`     | DF installation folder; enables local artwork and installation inspection. | Unset in browser mode                                 |
| `DFHACK_PORT` | Explicit override for the local DFHack TCP port.                           | Installation setting when available; otherwise `5000` |
| `VIEWER_PORT` | Browser companion HTTP/WebSocket port.                                     | `4174`                                                |
| `POLL_MS`     | Delay between individual block reads; minimum `100` ms.                    | `200`                                                 |

The example `.env` explicitly sets `DFHACK_PORT=5000`. Remove that assignment
to use the selected installation's configured port.

The desktop launcher chooses an available companion port automatically and
remembers its installation selection separately from the project's `.env`.

The development viewer uses port `5173`. If changing `VIEWER_PORT` during
development, also update the bridge proxy target in `vite.config.ts`.

Run `npm run inspect` with `DF_PATH` set to list installation module metadata.
This does not identify the loaded world's active mod order.

## Building Windows packages

On Windows x64:

```powershell
npm ci
npm run dist:win
```

The `release/` directory contains:

- `Deepwatch-Setup-<version>-x64.exe` — installer.
- `Deepwatch-<version>-x64.zip` — portable application.
- `SHA256SUMS.txt` — package checksums.

The version comes from `package.json`. Use `npm run pack:win` for an unpacked
application, or `npm run desktop:smoke` to check desktop startup, WebGL,
renderer isolation and connection to the companion. This smoke check does not
prove a live game connection.

### GitHub builds and releases

Run **Actions → Windows app → Run workflow** to produce downloadable build
artifacts. The workflow tests, builds and smoke-tests the packaged executable.

A pushed `v` tag matching `package.json`, such as `v0.1.0`, also triggers
release packaging. For a new tag, the workflow creates a **draft GitHub Release**
with the installer, ZIP and checksums for review and publication.

## Development and verification

The project uses TypeScript, Three.js, a Node.js HTTP/WebSocket companion,
Protocol Buffers, Vite and an Electron desktop shell.

| Directory     | Responsibility                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `src/bridge/` | DFHack reads, fixed single-tile mining executor, installation/graphics loading and local server. |
| `src/shared/` | Viewer data model and message validation.                                                        |
| `src/viewer/` | Three.js rendering, navigation and HTML/CSS interface.                                           |
| `desktop/`    | Desktop launcher and companion lifecycle.                                                        |
| `tests/`      | Synthetic fixtures, mock RPC tests and regression coverage.                                      |
| `docs/`       | Architecture, progress and verification notes.                                                   |

Run the standard checks with:

```powershell
npm run check
npm test
npm run build
npm run format:check
```

Tests use synthetic data and a local mock RPC server. They do not need saves or
game artwork, and do not issue gameplay commands. Live verification is documented
separately:

- [Architecture and protocol decisions](docs/architecture.md)
- [Implementation progress and verification](docs/progress.md)
- [Live first-person navigation checks](docs/live-navigation-check.md)
- [Texture fidelity review](docs/texture-fidelity-review.md)

Keep game assets, saves, generated atlases, local configuration and caches out of
commits and release packages.

## Troubleshooting

| Problem                                   | What to check                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disconnected / RPC failure**            | Confirm DFHack is running and a fortress is loaded. The viewer retries dropped connections after 2 seconds, times out stalled handshakes after 8 seconds, and detects silent sockets after 15 seconds. It also resumes cached pages and retries when the network returns. Mining requests are never replayed. In the desktop app, check **Help → Open log folder**. |
| **Unsupported version**                   | Only the documented version combination is accepted. Supporting another version requires checking its protocol and semantics.                                                                                                                                                                                                                                       |
| **Empty or opaque terrain**               | The selected levels may be sky or undiscovered rock. Try another cutaway level and allow nearby blocks to load.                                                                                                                                                                                                                                                     |
| **Changes appear slowly**                 | Terrain is revisited in batches, with nearby columns loaded first. A 192 × 192 footprint across 16 levels requires 2304 block reads. DF Screen mode reduces the requested area.                                                                                                                                                                                     |
| **First-person movement is blocked**      | Wait for ground and overhead data. Choose a green starting point; hidden, disconnected and unloaded destinations are blocked.                                                                                                                                                                                                                                       |
| **Mouse capture fails**                   | Click the viewport, then keep the pointer over it for fallback mouse look. Escape pauses; clicking resumes.                                                                                                                                                                                                                                                         |
| **Artwork is missing or differs from DF** | Check the selected installation or `DF_PATH`. Unsupported graphics use fallbacks; active mod overrides are not resolved yet.                                                                                                                                                                                                                                        |
| **WebGL is unavailable**                  | Check browser/app hardware acceleration and graphics-driver support. Renderer failures appear in the status area.                                                                                                                                                                                                                                                   |
| **Port is occupied**                      | Stop the other companion process. Browser development and production companions cannot share a port. The desktop app chooses its own available port.                                                                                                                                                                                                                |

## Privacy and licence

The viewer and companion run locally. No account, telemetry, asset upload or
cloud service is required to use them. The companion binds to loopback and
exposes a restricted viewer protocol, rather than a general DFHack command proxy.

Deepwatch's code is available under the [MIT licence](LICENSE). Dwarf Fortress,
its artwork and third-party assets remain subject to their respective owners'
rights and licences. This project's licence does not grant rights to game assets.
