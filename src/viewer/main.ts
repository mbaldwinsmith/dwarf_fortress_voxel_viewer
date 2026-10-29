import "./style.css";
import { WorldState, tileAt } from "../shared/model.js";
import { FortressScene } from "./scene.js";
import { connect } from "./connection.js";
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
function cut() {
  const z = Number(slider.value);
  scene.setCut(z);
  level.textContent = `Z ${z}`;
  clearTimeout(levelTimer);
  levelTimer = setTimeout(() => disconnect.setLevel(z), 200);
}
slider.addEventListener("input", cut);
el("frame").addEventListener("click", () => scene.frame());
scene.onSelect = (x, y, z) => {
  const t = tileAt(state.chunks, x, y, z);
  selection.textContent =
    t?.shape === "unknown"
      ? "Undiscovered tile"
      : t
        ? `${t.name} · ${t.shape} · X ${x}, Y ${y}, Z ${z}`
        : "No tile at this position";
};
const keydown = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement) return;
  if (slider.disabled && (e.key === "[" || e.key === "]")) return;
  if (e.key === "[" || e.key === "]") {
    slider.value = String(Number(slider.value) + (e.key === "]" ? 1 : -1));
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
  if (m.type === "reset") {
    state.reset(m.session);
    scene.reset(m.bounds, m.level);
    world.textContent = m.world || "Awaiting a fortress";
    slider.min = String(m.bounds.z);
    slider.max = String(m.bounds.z + Math.max(0, m.bounds.height - 1));
    slider.value = String(m.level ?? slider.max);
    slider.disabled = !m.bounds.height || m.mode === "screen";
    el<HTMLInputElement>("mode-screen").checked = m.mode === "screen";
    el<HTMLInputElement>("mode-map").checked = m.mode !== "screen";
    el("scope").textContent =
      m.mode === "screen"
        ? "Read-only · Following DF screen and Z · Block-aligned tiles, three levels deep"
        : "Read-only · Full local map · Three levels at the selected cutaway";
    level.textContent = m.bounds.height ? `Z ${slider.value}` : "—";
    empty.hidden = false;
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
