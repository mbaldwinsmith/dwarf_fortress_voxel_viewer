import "./style.css";
import { WorldState, tileAt, retainChunks, chunkKey } from "../shared/model.js";
import { FortressScene } from "./scene.js";
import { connect } from "./connection.js";
import { levelDirection } from "./keyboard.js";
import { MINING_DELAY_MS, type MiningMode } from "../shared/mining.js";
import type { SpriteRef } from "../shared/model.js";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const status = el("status"),
  world = el("world"),
  slider = el<HTMLInputElement>("level"),
  level = el("level-value"),
  empty = el("empty"),
  selection = el("selection");
const state = new WorldState();
const miningMode = el<HTMLSelectElement>("mining-mode"),
  miningPreview = el("mining-preview"),
  miningIcon = el("mining-icon"),
  miningProgress = el<HTMLProgressElement>("mining-progress");
let miningAssets: { pick: SpriteRef; spade: SpriteRef } | undefined;
let miningId = 0,
  pendingMiningId: number | undefined,
  currentIcon = "";
let scene: FortressScene;
try {
  scene = new FortressScene(el("viewport"), state, el("stats"));
} catch (e) {
  status.textContent = `WebGL unavailable: ${String(e)}`;
  throw e;
}
const setStatus = (s: string) => {
  status.textContent = s;
  if (/disconnected|Cannot reach/i.test(s)) {
    scene.cancelMining();
    scene.miningBusy = false;
    pendingMiningId = undefined;
    miningMode.disabled = true;
  }
};
miningMode.addEventListener("change", () => {
  scene.miningMode = miningMode.value as MiningMode;
  scene.cancelMining();
  miningPreview.hidden = true;
  el("scope").textContent = el("scope").textContent!.replace(
    /^[^·]+/,
    `${miningMode.selectedOptions[0].textContent} `,
  );
});
scene.onMine = (target) => {
  if (scene.miningBusy || scene.miningMode === "inspect" || !state.session)
    return;
  const request = {
    type: "mining" as const,
    id: ++miningId,
    session: state.session,
    mode: scene.miningMode,
    ...target,
  };
  scene.miningBusy = true;
  pendingMiningId = request.id;
  if (!disconnect.mine(request)) {
    scene.miningBusy = false;
    pendingMiningId = undefined;
    selection.textContent = "Companion disconnected; action not sent";
  }
};
scene.onMiningPreview = (preview) => {
  miningPreview.hidden = !preview.target || !miningAssets;
  if (!preview.target || !miningAssets) return;
  miningPreview.style.left = `${preview.x}px`;
  miningPreview.style.top = `${preview.y}px`;
  const ref =
      preview.target.operation === "channel"
        ? miningAssets.spade
        : miningAssets.pick,
    key = JSON.stringify(ref);
  if (currentIcon !== key) {
    currentIcon = key;
    const scaleX = 48 / ref.width,
      scaleY = 48 / ref.height;
    miningIcon.style.backgroundImage = `url("/local-art/${ref.asset}")`;
    miningIcon.style.backgroundSize = `${ref.pageWidth * scaleX}px ${ref.pageHeight * scaleY}px`;
    miningIcon.style.backgroundPosition = `${-ref.x * scaleX}px ${-ref.y * scaleY}px`;
  }
  miningIcon.classList.toggle("mining-flash", preview.holding);
  miningProgress.hidden = !preview.holding && !scene.miningBusy;
  miningProgress.value = preview.progress;
  const label =
    preview.target.operation === "ceiling"
      ? "Dig upward"
      : preview.target.operation === "channel"
        ? "Channel down"
        : "Mine wall";
  el("mining-hint").textContent = scene.miningBusy
    ? "Applying…"
    : preview.holding
      ? `${label} · ${(((1 - preview.progress) * MINING_DELAY_MS) / 1000).toFixed(1)}s`
      : scene.miningMode === "designate"
        ? `${label} · Click to designate`
        : `${label} · ${scene.navigation === "firstPerson" ? "Hold left mouse" : "Click to dig"}`;
};
let levelTimer: ReturnType<typeof setTimeout>;
let walkingRequest: number | undefined;
scene.onWalkLevel = (z) => {
  walkingRequest = z;
  slider.value = String(z);
  level.textContent = `Z ${z}`;
  clearTimeout(levelTimer);
  disconnect.setLevel(
    z,
    Math.floor(scene.camera.position.x),
    Math.floor(scene.camera.position.z),
  );
};
scene.firstPerson.onCaptureChange = (message) => {
  if (scene.navigation === "firstPerson") el("walk-help").textContent = message;
};
function cut() {
  const z = Number(slider.value);
  scene.setCut(z);
  level.textContent = `Z ${z}`;
  clearTimeout(levelTimer);
  levelTimer = setTimeout(() => disconnect.setLevel(z), 200);
}
slider.addEventListener("input", cut);
el("frame").addEventListener("click", () => scene.frame());
scene.onNavigationChange = (mode) => {
  if (mode === "firstPerson")
    disconnect.setLevel(
      scene.cut,
      Math.floor(scene.camera.position.x),
      Math.floor(scene.camera.position.z),
    );
  const enabled = mode !== "orbit";
  el("first-person").setAttribute("aria-pressed", String(enabled));
  el("first-person").textContent = enabled ? "Orbit view" : "1st person";
  el("choose-spawn").hidden = mode !== "firstPerson";
  el("walk-help").hidden = !enabled;
  el("crosshair").hidden = mode !== "firstPerson";
  el("walk-help").textContent =
    mode === "select"
      ? "Choose a camera point: click a glowing green floor tile. Red means blocked or still loading."
      : "WASD to walk · Mouse to look · On stairs: < up, > down (hold Shift) · Esc pauses · Click the view to resume";
};
el("first-person").addEventListener("click", () => {
  const enabled = scene.navigation === "orbit";
  scene.setFirstPerson(enabled);
  if (enabled) disconnect.setMode("map");
});
el("choose-spawn").addEventListener("click", () => scene.setFirstPerson(true));
scene.onSelect = (x, y, z) => {
  const t = tileAt(state.chunks, x, y, z);
  selection.textContent =
    t?.shape === "unknown"
      ? "Undiscovered tile"
      : t
        ? `${t.name}${t.materialName ? ` · ${t.materialName}` : ""} · ${t.shape} · X ${x}, Y ${y}, Z ${z}`
        : "No tile at this position";
};
const keydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  if (e.key === "Escape") {
    scene.cancelMining();
    miningMode.value = "inspect";
    miningMode.dispatchEvent(new Event("change"));
  }
  if (
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    (target instanceof HTMLInputElement &&
      !["range", "radio", "checkbox"].includes(target.type))
  )
    return;
  const direction = levelDirection(e);
  if (direction) {
    e.preventDefault();
    if (scene.navigation === "firstPerson" || !scene.bounds?.height) return;
    slider.value = String(
      Math.max(
        Number(slider.min),
        Math.min(Number(slider.max), Number(slider.value) + direction),
      ),
    );
    cut();
  }
  if (e.key.toLowerCase() === "f") scene.frame();
};
window.addEventListener("keydown", keydown);
const disconnect = connect((m) => {
  if (m.type === "mining-assets") {
    if (m.session === state.session) {
      miningAssets = m;
      currentIcon = "";
      miningMode.disabled = false;
    }
    return;
  }
  if (m.type === "mining-result") {
    if (m.session === state.session && pendingMiningId === m.id) {
      scene.miningBusy = false;
      pendingMiningId = undefined;
      selection.textContent = m.message;
    }
    return;
  }
  if (m.type === "status") {
    setStatus(m.message);
    return;
  }
  if (m.type === "reset" || m.type === "view") {
    if (m.type === "view" && m.session !== state.session) return;
    // Several stairs can be crossed before an older stream acknowledges its
    // view. Only the latest walking request may move/prune the camera's window.
    if (
      m.type === "view" &&
      scene.navigation === "firstPerson" &&
      walkingRequest !== undefined &&
      m.level !== walkingRequest
    )
      return;
    const keepWalking =
      scene.navigation === "firstPerson" &&
      m.type === "view" &&
      (walkingRequest === m.level || scene.cut === m.level) &&
      JSON.stringify(m.bounds) === JSON.stringify(scene.bounds);
    if (walkingRequest === m.level) walkingRequest = undefined;
    if (m.type === "reset") {
      miningAssets = undefined;
      miningMode.disabled = true;
      miningMode.value = "inspect";
      scene.miningMode = "inspect";
      scene.cancelMining();
      scene.miningBusy = false;
      pendingMiningId = undefined;
      miningPreview.hidden = true;
      state.reset(m.session);
      scene.reset(m.bounds, m.level);
      world.textContent = m.world || "Awaiting a fortress";
    } else {
      retainChunks(state.chunks, m.bounds, m.level);
      scene.changeView(m.bounds, m.level, keepWalking);
    }
    slider.min = String(m.bounds.z);
    slider.max = String(m.bounds.z + Math.max(0, m.bounds.height - 1));
    slider.value = String(m.level ?? slider.max);
    slider.disabled = !m.bounds.height;
    el<HTMLInputElement>("mode-screen").checked = m.mode === "screen";
    el<HTMLInputElement>("mode-map").checked = m.mode !== "screen";
    el("scope").textContent =
      m.mode === "screen"
        ? `${miningMode.selectedOptions[0].textContent} · DF screen area · 5 levels below, 10 above`
        : `${miningMode.selectedOptions[0].textContent} · Full local map · 5 levels below, 10 above`;
    level.textContent = m.bounds.height ? `Z ${slider.value}` : "—";
    empty.hidden = keepWalking || state.chunks.size > 0;
    selection.textContent = "Click a visible tile to inspect it.";
    return;
  }
  if (m.type === "creatures") {
    if (m.session === state.session) scene.creatures.snapshot(m);
    return;
  }
  const terrain = m.chunks.filter((c) => {
    const previous = state.chunks.get(chunkKey(c));
    return (
      !previous ||
      JSON.stringify(previous.ceilingTexture) !==
        JSON.stringify(c.ceilingTexture) ||
      JSON.stringify(previous.tiles) !== JSON.stringify(c.tiles) ||
      JSON.stringify(previous.flows) !== JSON.stringify(c.flows)
    );
  });
  if (!state.merge(m)) {
    setStatus("State sequence mismatch · reconnecting");
    location.reload();
    return;
  }
  const changedTerrain = new Set(terrain.map(chunkKey));
  scene.scenery.update(
    m.chunks.filter((c) => !changedTerrain.has(chunkKey(c))),
    state.chunks,
    scene.navigation === "firstPerson",
  );
  scene.update(terrain);
  empty.hidden = state.chunks.size > 0;
}, setStatus);
for (const mode of ["screen", "map"] as const)
  el(`mode-${mode}`).addEventListener("change", () => {
    clearTimeout(levelTimer);
    disconnect.setMode(mode);
  });
window.addEventListener(
  "pagehide",
  () => {
    clearTimeout(levelTimer);
    disconnect();
    scene.dispose();
    window.removeEventListener("keydown", keydown);
  },
  { once: true },
);
