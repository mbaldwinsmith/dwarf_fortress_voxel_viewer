# Deepwatch

**A live 3D voxel viewer for Dwarf Fortress.**

Explore your fortress from another perspective. **Deepwatch** connects to a running
game through DFHack and renders its terrain, creatures and furnishings in WebGL.
Orbit above an excavation, cut through the mountain, or step into the halls in
first person.

Deepwatch runs locally and reads artwork from your own Dwarf Fortress installation.
It does not issue gameplay commands or modify your game files and saves.

> **Early development:** currently supports **Dwarf Fortress 53.16**,
> **DFHack 53.16-r3** and **RemoteFortressReader 0.21.0**. Other version
> combinations are rejected until verified.

## Features

- **Live fortress terrain:** progressively loaded walls, floors, ramps, stairs
  and excavations, with updates while the game runs.
- **Orbit and cutaway views:** pan, zoom and inspect tiles across the map's
  Z-levels, or follow the area currently visible in DF.
- **First-person exploration:** choose a starting point and walk through revealed
  terrain, including connected stairs and ramps.
- **Authentic local artwork:** installed vanilla terrain textures, creature
  sprites, workshops, furniture, plants and supported ground items.
- **Layered dwarves:** supported clothing, armour and equipment, plus appearance
  details drawn from live game data.
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
| **DF screen**  | Follows DF's visible map area and current Z-level; the manual slider is disabled. |
| **1st person** | Switches to Whole map and lets you choose a walkable camera starting point.       |

Deepwatch streams **up to five neighbouring Z-levels**: the selected level,
two above and two below, clipped to map bounds. Nearby columns load first;
in first person, level-change requests prioritise the camera's neighbourhood.

Orbit view hides geometry above the selected cutaway. First person displays the
loaded upper levels too, so ceilings, stair shafts and upper landings remain
visible. The entire vertical map is not loaded at once.

All tabs connected to the same companion share the view mode and selected
Z-level. The latest selection applies to everyone.

### Orbit controls

| Action               | Control                                          |
| -------------------- | ------------------------------------------------ |
| Orbit                | Left-drag                                        |
| Pan                  | Right-drag                                       |
| Zoom                 | Mouse wheel                                      |
| Change cutaway level | Slider or `[` / `]` in Whole map mode            |
| Frame terrain        | **Frame terrain** or `F`                         |
| Inspect a tile       | Click terrain; details appear below the viewer   |
| Touch navigation     | One finger to orbit; two fingers to pan and zoom |

Routine updates preserve the camera. In orbit view, changing Z preserves its
horizontal position and shifts its height with the cutaway.

### First-person controls

Select **1st person**, then click a green floor selector to enter. Red indicates
a blocked location or terrain/headroom data that has not yet loaded.

| Action                           | Control                          |
| -------------------------------- | -------------------------------- |
| Walk / strafe                    | `W`, `A`, `S`, `D`               |
| Look around                      | Mouse                            |
| Ascend connected stairs          | Hold `W` while on the stair tile |
| Descend connected stairs         | Hold `S` while on the stair tile |
| Pause and release mouse capture  | `Esc`                            |
| Resume                           | Click the viewport               |
| Relocate                         | **Choose another point**         |
| Return to the saved orbit camera | **Orbit view**                   |

Ramps follow the rendered slope. The camera and streamed Z-levels follow
successful stair and ramp transitions. Movement waits when destination data is
missing; hidden, disconnected or blocked destinations cannot be entered.

If mouse capture is unavailable, keep the pointer over the viewport to look
around. Click the view to focus keyboard controls. The on-screen banner reports
whether controls are active or paused.

Manual Z changes and unrelated reconnections return to starting-point selection.
Furniture and doors do not currently block camera movement.

## Local graphics and fidelity

Deepwatch supplies its own geometry and reads supported vanilla graphics from
your installation at runtime. Proprietary game images and saves are not included
in the repository or application packages.

The current graphics profile is explicitly **vanilla**. Installation inspection
can list available modules, but does not resolve the loaded world's active mod
order or graphics overrides.

| Element                 | Current representation                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Terrain                 | Generated 3D geometry with installed wall/floor artwork, native edge variants and material information. |
| Dwarves                 | Camera-facing sprites with a partial layered appearance compositor.                                     |
| Other creatures         | Supported local sprites; markers for unsupported creatures.                                             |
| Workshops and furniture | Mostly artwork laid on the ground; doors use upright open/closed sprites.                               |
| Vegetation              | Species sprites for supported plants and tree parts; fallback geometry where needed.                    |
| Ground items            | One supported item sprite per occupied tile.                                                            |

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
- Only supported loose ground items are displayed. Carried items, container
  contents, installed components, projectiles and hidden items are excluded.
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

| Directory     | Responsibility                                                                         |
| ------------- | -------------------------------------------------------------------------------------- |
| `src/bridge/` | DFHack connection, read-only adapter, installation and graphics loading, local server. |
| `src/shared/` | Viewer data model and message validation.                                              |
| `src/viewer/` | Three.js rendering, navigation and HTML/CSS interface.                                 |
| `desktop/`    | Desktop launcher and companion lifecycle.                                              |
| `tests/`      | Synthetic fixtures, mock RPC tests and regression coverage.                            |
| `docs/`       | Architecture, progress and verification notes.                                         |

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

| Problem                                   | What to check                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Disconnected / RPC failure**            | Confirm DFHack is running, a fortress is loaded and the port is correct. The companion retries automatically. In the desktop app, check **Help → Open log folder**.                                                                  |
| **Unsupported version**                   | Only the documented version combination is accepted. Supporting another version requires checking its protocol and semantics.                                                                                                        |
| **Empty or opaque terrain**               | The selected levels may be sky or undiscovered rock. Try another cutaway level and allow nearby blocks to load.                                                                                                                      |
| **Changes appear slowly**                 | Terrain is revisited block by block. A 192 × 192 footprint across five levels requires 720 block reads: the default delays alone total about 144 seconds, before RPC and processing time. DF screen mode reduces the requested area. |
| **First-person movement is blocked**      | Wait for ground and overhead data. Choose a green starting point; hidden, disconnected and unloaded destinations are blocked.                                                                                                        |
| **Mouse capture fails**                   | Click the viewport, then keep the pointer over it for fallback mouse look. Escape pauses; clicking resumes.                                                                                                                          |
| **Artwork is missing or differs from DF** | Check the selected installation or `DF_PATH`. Unsupported graphics use fallbacks; active mod overrides are not resolved yet.                                                                                                         |
| **WebGL is unavailable**                  | Check browser/app hardware acceleration and graphics-driver support. Renderer failures appear in the status area.                                                                                                                    |
| **Port is occupied**                      | Stop the other companion process. Browser development and production companions cannot share a port. The desktop app chooses its own available port.                                                                                 |

## Privacy and licence

The viewer and companion run locally. No account, telemetry, asset upload or
cloud service is required to use them. The companion binds to loopback and
exposes a restricted viewer protocol, rather than a general DFHack command proxy.

Deepwatch's code is available under the [MIT licence](LICENSE). Dwarf Fortress,
its artwork and third-party assets remain subject to their respective owners'
rights and licences. This project's licence does not grant rights to game assets.
