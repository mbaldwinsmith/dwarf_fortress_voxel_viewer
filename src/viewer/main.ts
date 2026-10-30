import "./style.css";
import { WorldState, tileAt, retainChunks } from "../shared/model.js";
import { FortressScene } from "./scene.js";
import { connect } from "./connection.js";
import { levelDirection } from "./keyboard.js";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const status = el("status"),
  world = el("world"),
  slider = el<HTMLInputElement>("level"),
  level = el("level-value"),
  empty = el("empty"),
  selection = el("selection");
const state = new WorldState();
let scene: FortressScene;
try {
  scene = new FortressScene(el("viewport"), state, el("stats"));
} catch (e) {
  status.textContent = `WebGL unavailable: ${String(e)}`;
  throw e;
}
const setStatus = (s: string) => {
  status.textContent = s;
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
  if (
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
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
  if (m.type === "status") {
    setStatus(m.message);
    return;
  }
  if (m.type === "reset" || m.type === "view") {
    if (m.type === "view" && m.session !== state.session) return;
    const keepWalking =
      scene.navigation === "firstPerson" &&
      m.type === "view" &&
      (walkingRequest === m.level || scene.cut === m.level) &&
      JSON.stringify(m.bounds) === JSON.stringify(scene.bounds);
    if (walkingRequest === m.level) walkingRequest = undefined;
    if (m.type === "reset") {
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
        ? "Read-only · DF screen area · 5 levels below, 10 above"
        : "Read-only · Full local map · 5 levels below, 10 above";
    level.textContent = m.bounds.height ? `Z ${slider.value}` : "—";
    empty.hidden = keepWalking || state.chunks.size > 0;
    selection.textContent = "Click a visible tile to inspect it.";
    return;
  }
  if (m.type === "creatures") {
    if (m.session === state.session) scene.creatures.snapshot(m);
    return;
  }
  if (!state.merge(m)) {
    setStatus("State sequence mismatch · reconnecting");
    location.reload();
    return;
  }
  scene.update(m.chunks);
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
