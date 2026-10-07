import { snapshot } from "./PageCache.js";
import { foldGeometry, polygonCss, type Corner, type Point } from "./foldGeometry.js";

/** The folded portion is reflected across the pointer-controlled crease. */
export class FlipSheet {
  private layer = document.createElement("div");
  private front = document.createElement("div");
  private back = document.createElement("div");
  private under = document.createElement("div");
  private frontShade = document.createElement("div");
  private backShade = document.createElement("div");
  private frame = 0;
  private settle?: (completed: boolean) => void;
  private disposed = false;
  private point: Point;
  readonly width: number;
  readonly height: number;
  readonly right: boolean;
  constructor(private stage: HTMLElement, private from: HTMLElement, private pages: HTMLElement[],
    private forward: boolean, rtl: boolean, private spread: 1 | 2, readonly corner: Corner) {
    this.width = stage.clientWidth / spread; this.height = stage.clientHeight; this.right = forward !== rtl;
    this.point = { x: this.width - .01, y: corner === "top" ? 0 : this.height };
    this.layer.className = "br-sheet br-fold"; this.layer.setAttribute("aria-hidden", "true");
    this.layer.style.width = `${this.width}px`; this.layer.style.left = this.right ? `${stage.clientWidth - this.width}px` : "0";
    if (!this.right) this.layer.style.transform = "scaleX(-1)";
    this.front.className = "br-fold-front"; this.back.className = "br-fold-back"; this.under.className = "br-fold-under";
    this.frontShade.className = this.backShade.className = "br-fold-shade";
    this.front.append(this.face(from, !this.right), this.frontShade);
    this.updatePages(pages); this.layer.append(this.under, this.front, this.back);
    from.style.visibility = "hidden"; stage.append(this.layer); this.update(this.point);
  }
  private face(page: HTMLElement | undefined, mirror: boolean): HTMLElement {
    const face = page ? snapshot(page) : document.createElement("div");
    face.classList.add("br-fold-face"); face.style.visibility = "";
    if (mirror) face.style.transform = "scaleX(-1)"; return face;
  }
  updatePages(pages: HTMLElement[]) {
    if (this.disposed) return;
    this.pages = pages;
    this.under.replaceChildren(this.face(pages[this.forward ? this.spread - 1 : 0], !this.right));
    this.back.replaceChildren(this.face(pages[this.forward ? 0 : this.spread - 1], this.right), this.backShade);
  }
  update(point: Point) {
    if (this.disposed) return;
    const fold = foldGeometry(this.width, this.height, this.corner, point); this.point = fold.point;
    this.front.style.clipPath = polygonCss(fold.front); this.back.style.clipPath = polygonCss(fold.back);
    this.back.style.transform = `matrix(${fold.matrix.join(",")})`;
    const stop = fold.shadowStop, band = fold.shadowBand, angle = fold.shadowAngle;
    this.frontShade.style.background = `linear-gradient(${angle}deg,transparent ${stop - band}%,var(--br-fold-shadow) ${stop}%,transparent ${stop + band}%)`;
    this.backShade.style.background = this.frontShade.style.background;
    this.layer.dataset.progress = fold.progress.toFixed(3);
  }
  get progress() { return foldGeometry(this.width, this.height, this.corner, this.point).progress; }
  finish(commit: boolean, duration: number, signal: AbortSignal): Promise<boolean> {
    if (this.disposed || signal.aborted) return Promise.resolve(false);
    cancelAnimationFrame(this.frame);
    const start = { ...this.point }, y = this.corner === "top" ? 0 : this.height;
    const end = { x: commit ? -this.width : this.width - .01, y };
    const time = duration * Math.max(.18, commit ? 1 - this.progress : this.progress);
    return new Promise(resolve => {
      this.settle = resolve;
      const abort = () => complete(false);
      const complete = (result: boolean) => {
        cancelAnimationFrame(this.frame); signal.removeEventListener("abort", abort); this.settle = undefined; resolve(result);
      };
      signal.addEventListener("abort", abort, { once: true }); const started = performance.now();
      const tick = (now: number) => {
        const progress = time ? Math.min(1, (now - started) / time) : 1;
        const ease = 1 - (1 - progress) ** 3;
        this.update({ x: start.x + (end.x - start.x) * ease, y: start.y + (end.y - start.y) * ease });
        if (progress < 1) this.frame = requestAnimationFrame(tick); else complete(commit);
      };
      if (!duration) tick(started); else this.frame = requestAnimationFrame(tick);
    });
  }
  destroy() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame);
    this.settle?.(false); this.settle = undefined; this.layer.remove(); this.from.style.visibility = "";
  }
}
