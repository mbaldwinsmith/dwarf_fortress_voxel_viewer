# Digging and designation tools

## Interaction

Inspect is the default. Selecting Digging or Designation enables explicit
single-tile actions in Orbit, DF Screen and first-person views. Left-drag still
pans in the orbiting views; right-drag rotates. A drag never dispatches a dig.

In first-person Digging mode, hold left mouse for 750 ms while aiming at the
same revealed natural tile within five tiles. The installed designation icon
flashes while a progress bar/countdown runs. Release, target change, Escape,
focus loss, pointer cancellation or navigation-mode change cancels the hold.
One completed hold dispatches one action; it does not auto-repeat into the next
tile. First-person controls must be active before a mining gesture starts.
Designation mode creates a normal mining job on a click without the hold delay.

A wall uses the native DESIGNATION_DIG_STANDARD pick. Looking down at a floor
channels it and shows DESIGNATION_DIG_CHANNEL, the spade. Looking upward shows
the pick and channels the targeted ceiling tile: ordinary wall mining would
leave its floor behind, while channeling opens the ceiling. No upward route is
automatically constructed. If a supporting floor disappears, the local camera
settles onto loaded, revealed walkable ground within the five levels below.

Native RFR designation data is rendered with the installed icons on revealed
walls/floors. Item-only polls preserve these markers. Completed digs refresh the
surrounding 3x3 columns and three levels immediately, rather than waiting for the
normal sweep. Terrain edits invalidate nearby reserved cache entries as well.

## Command boundary

The normal RemoteFortressReader method allowlist remains unchanged. The sole
write path encodes a fixed Lua program through the native core command RPC;
clients cannot supply a command, script, function or filesystem path. Coordinates,
operation and save identity are separate arguments, never interpolated Lua.
No helper is installed in the game directory.

Each request carries a current world session and monotonically increasing client
id. The companion admits one pending action per connection and at most sixteen
queued actions. Closed clients and stale sessions are rejected before mutation.
Actions run serially with normal reads on the existing single-flight connection.

Execution rereads the target, checks world identity, and performs a native dry-run
preflight. The fixed program holds DFHack's core lock, verifies fortress/save,
map bounds, discovery, natural terrain, occupancy and original tile type, then
applies exactly one designation. A conflicting existing designation is preserved.
Digging completes only that tile through plugins.dig-now.dig_now_tile; designation
mode requests normal designation-job processing. Trees, constructions, buildings,
undiscovered cells and outer map boundaries are excluded. Instant digging follows
DFHack's ordinary item-generation settings and awards no unit experience.

## Verification

Regression tests cover request validation, hidden/construction/tree exclusions,
hold completion/cancellation, the two-phase executor, current-session checks,
refresh bounds, fixed RPC payloads and fragmented native results, visible
native designations, item-only preservation and camera settling.

A mocked WebSocket browser check exercised both render modes and first person:
release cancellation, target-change cancellation, 759 ms measured completion,
pick/spade selection, ceiling removal, designation without terrain removal,
channel camera descent and drag-without-dig. No page errors occurred.
The existing pan/rotate/inspection and shifted stair shortcuts also passed.

The real DFHack connection accepted the fixed program in dry-run mode and
confirmed that the selected tile's terrain and designation stayed unchanged.
Live destructive excavation was deliberately not used as a test: actual writes
are initiated by the user's digging/designation gestures in the preview.
