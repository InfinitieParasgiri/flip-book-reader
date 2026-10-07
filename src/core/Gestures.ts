import type { Point } from "./foldGeometry.js";
export type FoldGesture = {
  begin(point: Point): boolean; move(point: Point): void; end(commit: boolean, immediate?: boolean): void;
};
export class Gestures {
  private points = new Map<number, Point>();
  private start?: Point;
  private previous?: Point;
  private distance = 0;
  private gestureZoom = 1;
  private moved = false;
  private folding = false;
  private frame = 0;
  private latest?: Point;
  private controller = new AbortController();
  constructor(private viewport: HTMLElement, private zoom: () => number, private setZoom: (zoom: number) => void,
    private turn: (forward: boolean) => void, private active: (active: boolean) => void, private rtl: boolean, private fold: FoldGesture) {
    const options = { signal: this.controller.signal };
    viewport.addEventListener("pointerdown", this.down, options); viewport.addEventListener("pointermove", this.move, options);
    viewport.addEventListener("pointerup", this.up, options); viewport.addEventListener("pointercancel", this.cancel, options);
    viewport.addEventListener("lostpointercapture", this.cancel, options); viewport.addEventListener("wheel", this.wheel, { ...options, passive: false });
  }
  private down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,a,select,textarea")) return;
    const point = { x: event.clientX, y: event.clientY };
    this.points.set(event.pointerId, point); this.viewport.setPointerCapture(event.pointerId); this.active(true);
    if (this.points.size === 1) {
      this.start = this.previous = point; this.moved = false;
      this.folding = this.zoom() === 1 && this.fold.begin(point);
      if (this.folding) event.preventDefault();
    }
    if (this.points.size === 2) {
      if (this.folding) { this.fold.end(false, true); this.folding = false; }
      this.distance = this.span(); this.gestureZoom = this.zoom(); this.moved = true;
    }
  };
  private span() { const [a, b] = [...this.points.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  private flush = () => { this.frame = 0; if (this.folding && this.latest) this.fold.move(this.latest); };
  private move = (event: PointerEvent) => {
    if (!this.points.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY }; this.points.set(event.pointerId, point);
    if (this.points.size === 2 && this.distance > 0) { this.setZoom(this.gestureZoom * this.span() / this.distance); return; }
    if (this.folding) { this.latest = point; if (!this.frame) this.frame = requestAnimationFrame(this.flush); }
    else if (this.zoom() > 1 && this.previous) {
      this.viewport.scrollLeft -= point.x - this.previous.x; this.viewport.scrollTop -= point.y - this.previous.y; this.moved = true;
    }
    this.previous = point;
  };
  private up = (event: PointerEvent) => {
    if (!this.points.has(event.pointerId)) return;
    this.points.delete(event.pointerId);
    if (!this.points.size) {
      if (this.folding) {
        cancelAnimationFrame(this.frame); this.frame = 0; this.fold.move({ x: event.clientX, y: event.clientY });
        this.fold.end(true); this.folding = false;
      } else if (!this.moved && this.start && this.zoom() === 1) {
        const dx = event.clientX - this.start.x, dy = event.clientY - this.start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) this.turn((dx < 0) !== this.rtl);
      }
      this.start = this.previous = this.latest = undefined; this.active(false);
    }
  };
  private cancel = (event: PointerEvent) => {
    this.points.delete(event.pointerId); this.moved = true;
    if (!this.points.size) {
      if (this.folding) this.fold.end(false); this.folding = false;
      cancelAnimationFrame(this.frame); this.frame = 0;
      this.start = this.previous = this.latest = undefined; this.active(false);
    }
  };
  private wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); this.setZoom(this.zoom() + (event.deltaY < 0 ? .15 : -.15));
  };
  destroy() { this.controller.abort(); cancelAnimationFrame(this.frame); this.points.clear(); }
}
