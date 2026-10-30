import * as THREE from "three";

const keys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"]);
const up = new THREE.Vector3(0, 1, 0);
function editing(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}
export class OrbitKeyboard {
  private pressed = new Set<string>();
  constructor(
    private camera: THREE.PerspectiveCamera,
    private target: THREE.Vector3,
    private enabled: () => boolean,
  ) {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.release);
    window.addEventListener("blur", this.clear);
    window.addEventListener("focusin", this.focus);
  }
  private clear = () => {
    this.pressed.clear();
  };
  private focus = (e: FocusEvent) => {
    if (editing(e.target)) this.clear();
  };
  private down = (e: KeyboardEvent) => {
    if (
      !this.enabled() ||
      editing(e.target) ||
      e.ctrlKey ||
      e.altKey ||
      e.metaKey ||
      !keys.has(e.code)
    )
      return;
    e.preventDefault();
    this.pressed.add(e.code);
  };
  private release = (e: KeyboardEvent) => {
    this.pressed.delete(e.code);
  };
  update(dt: number) {
    if (!this.enabled()) {
      this.clear();
      return;
    }
    const delta = Math.min(Math.max(dt, 0), 0.05);
    const turn =
      Number(this.pressed.has("KeyQ")) - Number(this.pressed.has("KeyE"));
    if (turn) {
      const offset = this.camera.position
        .clone()
        .sub(this.target)
        .applyAxisAngle(up, (turn * delta * Math.PI) / 2);
      this.camera.position.copy(this.target).add(offset);
      this.camera.lookAt(this.target);
    }
    const forward =
      Number(this.pressed.has("KeyW")) - Number(this.pressed.has("KeyS"));
    const sideways =
      Number(this.pressed.has("KeyD")) - Number(this.pressed.has("KeyA"));
    if (!forward && !sideways) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      this.camera.quaternion,
    );
    right.y = 0;
    right.normalize();
    const direction = up
      .clone()
      .cross(right)
      .multiplyScalar(forward)
      .addScaledVector(right, sideways)
      .normalize();
    const speed = THREE.MathUtils.clamp(
      this.camera.position.distanceTo(this.target) * 0.6,
      2,
      120,
    );
    direction.multiplyScalar(speed * delta);
    this.camera.position.add(direction);
    this.target.add(direction);
  }
  dispose() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.release);
    window.removeEventListener("blur", this.clear);
    window.removeEventListener("focusin", this.focus);
    this.clear();
  }
}
