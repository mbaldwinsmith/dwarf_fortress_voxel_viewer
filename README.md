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
One command runs Vite and the bridge. The initial region is at most 48 × 48
tiles, covering the current DF viewport Z and four levels beneath it. The first
full load takes roughly ten seconds at default polling settings.

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
uses original geometry and fallback colours; no DF artwork is bundled or served.

## Controls

- Left-drag: orbit. Right-drag: pan. Wheel: zoom.
- Cutaway slider or `[` / `]`: change the highest visible Z-level.
- Frame terrain or `F`: reset camera and frame the bounded region.
- Click terrain: inspect tile below the viewer. Hidden tiles stay undiscovered.
- Touch: one finger orbits; two fingers pan and zoom.

Routine terrain changes preserve the camera. To sample a different region, close
all viewer tabs, move the viewport in DF, then reopen the viewer.

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
cutaway and reconnect around a useful viewport. A black opaque region represents
undiscovered tiles, whose real shapes and materials never reach the browser.

**Changes appear slowly:** the bridge polls individual blocks conservatively;
a full sweep is approximately ten seconds. Render frames run independently.
No changes may be happening if the game is paused.

**WebGL unavailable:** enable a working hardware-accelerated browser. The viewer
reports renderer creation failures in its status area.

**Port occupied:** stop the other bridge/dev process. Do not run development and
production bridges on the same port. If changing `VIEWER_PORT` for development,
also update Vite's bridge proxy target.

No units, buildings or local sprite rendering yet. Ramps, stairs, trees and
fortifications are approximate; liquids are omitted. No external accounts,
telemetry, uploads or cloud services are required.
