type Point = { x: number; y: number };
export class Gestures {
  private points = new Map<number, Point>();
  private start?: Point;
  private previous?: Point;
  private distance = 0;
  private gestureZoom = 1;
  private moved = false;
  private controller = new AbortController();
  constructor(private viewport: HTMLElement, private zoom: () => number, private setZoom: (zoom: number) => void,
    private turn: (forward: boolean) => void, private active: (active: boolean) => void, private rtl: boolean) {
    const options = { signal: this.controller.signal };
    viewport.addEventListener("pointerdown", this.down, options);
    viewport.addEventListener("pointermove", this.move, options);
    viewport.addEventListener("pointerup", this.up, options);
    viewport.addEventListener("pointercancel", this.cancel, options);
    viewport.addEventListener("lostpointercapture", this.cancel, options);
    viewport.addEventListener("wheel", this.wheel, { ...options, passive: false });
  }
  private down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,a,select,textarea")) return;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.viewport.setPointerCapture(event.pointerId); this.active(true);
    if (this.points.size === 1) { this.start = this.previous = { x: event.clientX, y: event.clientY }; this.moved = false; }
    if (this.points.size === 2) { this.distance = this.span(); this.gestureZoom = this.zoom(); this.moved = true; }
  };
  private span() { const [a, b] = [...this.points.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  private move = (event: PointerEvent) => {
    if (!this.points.has(event.pointerId)) return;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.points.size === 2 && this.distance > 0) { this.setZoom(this.gestureZoom * this.span() / this.distance); return; }
    if (this.zoom() > 1 && this.previous) {
      this.viewport.scrollLeft -= event.clientX - this.previous.x; this.viewport.scrollTop -= event.clientY - this.previous.y;
      this.moved = true;
    }
    this.previous = { x: event.clientX, y: event.clientY };
  };
  private up = (event: PointerEvent) => {
    if (!this.points.has(event.pointerId)) return;
    this.points.delete(event.pointerId);
    if (!this.points.size) {
      if (!this.moved && this.start && this.zoom() === 1) {
        const dx = event.clientX - this.start.x, dy = event.clientY - this.start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) this.turn((dx < 0) !== this.rtl);
      }
      this.start = this.previous = undefined; this.active(false);
    }
  };
  private cancel = (event: PointerEvent) => {
    this.points.delete(event.pointerId); this.moved = true;
    if (!this.points.size) { this.start = this.previous = undefined; this.active(false); }
  };
  private wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); this.setZoom(this.zoom() + (event.deltaY < 0 ? .15 : -.15));
  };
  destroy() { this.controller.abort(); this.points.clear(); }
}
