import { readerLabels } from "./core/labels.js";
import type { PageSource, PageSize, ReaderAction, ReaderOptions, ReaderState } from "./types.js";
import { clampZoom, fitPages, safeLink, spreadStart, validateSource, visiblePages } from "./core/model.js";
import { ReaderView } from "./core/View.js";
import { Renderer } from "./core/Renderer.js";
import { Gestures } from "./core/Gestures.js";
import { Thumbnails } from "./core/Thumbnails.js";
import { AutoTurn } from "./core/AutoTurn.js";
import { buttonLabel } from "./core/icons.js";
import { Turns } from "./core/Turns.js";

export class BookReader {
  private view: ReaderView;
  private renderer: Renderer;
  private gestures: Gestures;
  private thumbs: Thumbnails;
  private auto: AutoTurn;
  private observer: ResizeObserver;
  private events = new AbortController();
  private turns: Turns;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private size: PageSize = { width: 1, height: 1 };
  private page = 0;
  private spread: 1 | 2 = 1;
  private zoom = 1;
  private turning = false;
  private interacting = false;
  private destroyed = false;
  private zoomTimer?: ReturnType<typeof setTimeout>;
  private resizeFrame = 0;
  constructor(host: HTMLElement, private source: PageSource, private options: ReaderOptions = {}) {
    validateSource(source.pageCount, source.size);
    if (options.downloadUrl) safeLink(options.downloadUrl); if (options.shareUrl) safeLink(options.shareUrl);
    if (options.spreadBreakpoint !== undefined && (!Number.isFinite(options.spreadBreakpoint) || options.spreadBreakpoint < 1)) throw new Error("Invalid spread breakpoint");
    if (options.animationDuration !== undefined && (!Number.isFinite(options.animationDuration) || options.animationDuration < 0 || options.animationDuration > 5000)) throw new Error("Invalid animation duration");
    const labels = readerLabels(options.labels);
    this.view = new ReaderView(labels, options, (action, value) => { void this.action(action, value); });
    this.renderer = new Renderer(source, this.view, error => options.onError?.(error));
    this.auto = new AutoTurn(options.autoTurnSeconds ?? 5,
      () => !this.destroyed && !this.turning && !this.interacting && this.zoom === 1 && !document.hidden,
      () => this.state.endPage >= source.pageCount - 1, () => this.next(), () => this.notify());
    this.thumbs = new Thumbnails(this.view.strip, source, labels, index => { void this.goTo(index); });
    this.turns = new Turns(this.view.stage, this.renderer, () => ({ page: this.page, count: source.pageCount, spread: this.spread,
      size: this.size, zoom: this.zoom, rtl: options.direction === "rtl", reducedMotion: options.reducedMotion ?? this.motion.matches,
      duration: options.animationDuration ?? 350 }), turning => { this.turning = turning; this.notify(); this.auto.reset(); },
      page => { this.page = page; this.thumbs.show(page); this.view.viewport.scrollTo(0, 0); this.warm(); });
    this.gestures = new Gestures(this.view.viewport, () => this.zoom, value => this.setZoom(value),
      forward => { void (forward ? this.next() : this.previous()); }, active => { this.interacting = active; this.auto.reset(); }, options.direction === "rtl", { begin: point => this.turns.beginDrag(point),
        move: point => this.turns.moveDrag(point), end: (commit, immediate) => this.turns.endDrag(commit, immediate) });
    this.page = spreadStart(options.initialPage ?? 0, source.pageCount, 1);
    host.append(this.view.root);
    this.observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame); this.resizeFrame = requestAnimationFrame(() => { void this.layout(); });
    });
    this.observer.observe(this.view.viewport);
    const eventOptions = { signal: this.events.signal };
    this.view.root.addEventListener("keydown", this.key, eventOptions);
    document.addEventListener("visibilitychange", () => this.auto.reset(), eventOptions);
    document.addEventListener("fullscreenchange", () => {
      const text = document.fullscreenElement === this.view.root ? labels.exitFullscreen : labels.fullscreen;
      const button = this.view.buttons.get("fullscreen")!; buttonLabel(button, text);
    }, eventOptions);
    void this.layout();
  }
  get state(): ReaderState {
    return { page: this.page, endPage: Math.min(this.source.pageCount - 1, this.page + this.spread - 1),
      pageCount: this.source.pageCount, spread: this.spread, zoom: this.zoom, turning: this.turning, autoplay: this.auto.enabled };
  }
  private notify() { if (!this.destroyed) { this.view.update(this.state); this.options.onStateChange?.(this.state); } }
  private async layout() {
    if (this.destroyed) return;
    const viewport = this.view.viewport;
    const spread = viewport.clientWidth >= (this.options.spreadBreakpoint ?? 760) ? 2 : 1;
    const size = fitPages(viewport.clientWidth, viewport.clientHeight, this.source.size, spread);
    if (spread === this.spread && Math.abs(size.width - this.size.width) < 1 && Math.abs(size.height - this.size.height) < 1) return;
    this.turns.cancel(); this.renderer.invalidate(true); this.turning = false;
    this.spread = spread; this.size = size; this.page = spreadStart(this.page, this.source.pageCount, spread);
    this.dimensions(); this.notify(); this.auto.reset();
    await this.renderer.pages(visiblePages(this.page, this.source.pageCount, spread), size, this.zoom);
    if (!this.destroyed) { this.thumbs.show(this.page); this.warm(); }
  }
  private dimensions() {
    this.view.stage.style.width = `${this.size.width * this.spread * this.zoom}px`;
    this.view.stage.style.height = `${this.size.height * this.zoom}px`;
    this.view.stage.style.setProperty("--br-spread", String(this.spread));
    this.view.viewport.classList.toggle("br-zoomed", this.zoom > 1);
  }
  private warm() {
    if (this.destroyed) return;
    const indices = [this.page - this.spread, this.page + this.spread]
      .filter(page => page >= 0 && page < this.source.pageCount)
      .flatMap(page => visiblePages(page, this.source.pageCount, this.spread));
    this.renderer.warm(indices, this.size, this.zoom);
  }
  next() { return this.destroyed ? Promise.resolve() : this.turns.next(); }
  previous() { return this.destroyed ? Promise.resolve() : this.turns.previous(); }
  goTo(index: number) { return this.destroyed ? Promise.resolve() : this.turns.goTo(index); }
  setZoom(value: number) {
    if (this.destroyed || this.turning) return;
    const zoom = clampZoom(value); if (zoom === this.zoom) return;
    this.renderer.invalidate(true); this.zoom = zoom; this.dimensions(); this.notify(); this.auto.reset(); clearTimeout(this.zoomTimer);
    this.zoomTimer = setTimeout(() => { if (!this.destroyed && !this.turning) void this.renderer.pages(visiblePages(this.page, this.source.pageCount, this.spread), this.size, this.zoom).then(() => this.warm()); }, 180);
  }
  setAutoTurn(enabled: boolean, seconds?: number) { if (this.destroyed) return; if (seconds !== undefined) this.auto.setInterval(seconds); this.auto.setEnabled(enabled); }
  private key = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest("input,textarea,select,button,a,[contenteditable]")) return;
    const rtl = this.options.direction === "rtl";
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); void ((event.key === "ArrowRight") !== rtl ? this.next() : this.previous()); }
    if (event.key === "Home") { event.preventDefault(); void this.goTo(0); }
    if (event.key === "End") { event.preventDefault(); void this.goTo(this.source.pageCount - 1); }
  };
  private async action(action: ReaderAction, value = 0) {
    this.auto.reset();
    try {
      switch (action) {
        case "previous": await this.previous(); break; case "next": await this.next(); break;
        case "page": await this.goTo(value); this.notify(); break;
        case "zoomIn": this.setZoom(this.zoom + .25); break; case "zoomOut": this.setZoom(this.zoom - .25); break;
        case "fit": this.setZoom(1); this.view.viewport.scrollTo(0, 0); break;
        case "autoplay": this.setAutoTurn(!this.auto.enabled); break;
        case "interval": this.auto.setInterval(value); break;
        case "thumbnails": this.view.strip.hidden = !this.view.strip.hidden; this.thumbs.show(this.page); this.notify(); break;
        case "fullscreen": if (document.fullscreenElement === this.view.root) await document.exitFullscreen(); else await this.view.root.requestFullscreen(); break;
        case "close": this.options.onClose?.(); break;
        case "download": if (this.options.onDownload) this.options.onDownload(); else this.openDownload(); break;
        case "share": await this.share(); break;
      }
    } catch (error) {
      this.options.onError?.(error);
      this.view.status.textContent = action === "fullscreen" ? readerLabels(this.options.labels).fullscreenError : action === "interval" ? readerLabels(this.options.labels).invalidInterval : readerLabels(this.options.labels).shareError;
      if (action === "interval") this.view.intervalInput.value = String(this.options.autoTurnSeconds ?? 5);
    }
  }
  private openDownload() {
    if (!this.options.downloadUrl) return;
    const link = document.createElement("a"); link.href = safeLink(this.options.downloadUrl); link.download = "";
    link.target = "_blank"; link.rel = "noopener noreferrer"; link.click();
  }
  private async share() {
    if (this.options.onShare) { await this.options.onShare(); return; }
    if (!this.options.shareUrl) return;
    const url = new URL(safeLink(this.options.shareUrl), document.baseURI).href;
    if (navigator.share) await navigator.share({ title: this.options.title, url });
    else { await navigator.clipboard.writeText(url); this.view.status.textContent = readerLabels(this.options.labels).copied; }
  }
  destroy() {
    if (this.destroyed) return; this.destroyed = true;
    this.events.abort(); this.turns.cancel(); this.auto.destroy(); this.observer.disconnect();
    cancelAnimationFrame(this.resizeFrame); clearTimeout(this.zoomTimer); this.gestures.destroy(); this.thumbs.clear(); this.renderer.destroy(); this.view.root.remove();
  }
}
