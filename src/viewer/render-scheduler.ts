/** Inputs/animation render immediately; a quiet scene only needs occasional
 * maintenance for asynchronously loaded artwork and visibility changes. */
export class RenderScheduler {
  private dirty = true;
  private last = -Infinity;
  invalidate = () => {
    this.dirty = true;
  };
  take(now: number, moving = false) {
    if (!this.dirty && !moving && now - this.last < 250) return false;
    this.dirty = false;
    this.last = now;
    return true;
  }
}
