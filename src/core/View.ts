import type { ReaderAction, ReaderLabels, ReaderOptions, ReaderState } from "../types.js";
import { icon, buttonLabel, autoplayIcon } from "./icons.js";
import { formatLabel } from "./model.js";

export class ReaderView {
  root = document.createElement("section");
  viewport = document.createElement("div");
  stage = document.createElement("div");
  strip = document.createElement("div");
  status = document.createElement("div");
  buttons = new Map<ReaderAction, HTMLButtonElement>();
  pageInput = document.createElement("input");
  intervalInput = document.createElement("input");
  private counter = document.createElement("span");
  constructor(private labels: ReaderLabels, options: ReaderOptions, action: (action: ReaderAction, value?: number) => void) {
    this.root.className = "br-reader"; this.root.dir = options.direction ?? "ltr";
    this.root.lang = options.language ?? "en"; this.root.setAttribute("aria-label", options.title ?? labels.reader);
    const header = document.createElement("header"); header.className = "br-toolbar";
    if (options.title) { const title = document.createElement("strong"); title.className = "br-title"; title.textContent = options.title; header.append(title); }
    const button = (key: ReaderAction, text: string) => {
      const element = document.createElement("button"); element.type = "button";
      const label = document.createElement("span"); label.className = "br-sr-only";
      element.append(icon(key), label); buttonLabel(element, text);
      element.addEventListener("click", () => action(key)); this.buttons.set(key, element); header.append(element);
    };
    button("previous", labels.previous); button("next", labels.next);
    this.pageInput.type = "number"; this.pageInput.min = "1"; this.pageInput.step = "1";
    this.pageInput.setAttribute("aria-label", labels.goToPage);
    this.pageInput.addEventListener("change", () => action("page", this.pageInput.valueAsNumber - 1));
    header.append(this.pageInput, this.counter);
    button("zoomOut", labels.zoomOut); button("zoomIn", labels.zoomIn); button("fit", labels.fit);
    button("thumbnails", labels.thumbnails); button("autoplay", labels.autoStart);
    this.intervalInput.type = "number"; this.intervalInput.min = "1"; this.intervalInput.max = "3600";
    this.intervalInput.value = String(options.autoTurnSeconds ?? 5);
    this.intervalInput.setAttribute("aria-label", labels.interval); this.intervalInput.title = labels.interval;
    this.intervalInput.addEventListener("change", () => action("interval", this.intervalInput.valueAsNumber));
    header.append(this.intervalInput); button("fullscreen", labels.fullscreen);
    if (options.downloadUrl || options.onDownload) button("download", labels.download);
    if (options.shareUrl || options.onShare) button("share", labels.share);
    if (options.onClose) button("close", labels.close);
    this.status.className = "br-status"; this.status.setAttribute("role", "status"); this.status.setAttribute("aria-live", "polite");
    const body = document.createElement("div"); body.className = "br-body";
    this.strip.className = "br-thumbnails"; this.strip.hidden = true; this.strip.setAttribute("aria-label", labels.thumbnails);
    this.viewport.className = "br-viewport"; this.viewport.tabIndex = 0;
    this.stage.className = "br-stage"; this.viewport.append(this.stage); body.append(this.strip, this.viewport);
    this.root.append(header, this.status, body);
  }
  update(state: ReaderState) {
    this.counter.textContent = formatLabel(this.labels.pageCounter, { start: state.page + 1, end: state.endPage + 1, total: state.pageCount });
    this.pageInput.value = String(state.page + 1); this.pageInput.max = String(state.pageCount);
    this.pageInput.disabled = state.turning;
    this.buttons.get("previous")!.disabled = state.turning || state.page === 0;
    this.buttons.get("next")!.disabled = state.turning || state.endPage >= state.pageCount - 1;
    this.buttons.get("zoomOut")!.disabled = state.zoom <= 1 || state.turning;
    this.buttons.get("zoomIn")!.disabled = state.zoom >= 3 || state.turning;
    const autoplay = this.buttons.get("autoplay")!;
    buttonLabel(autoplay, state.autoplay ? this.labels.autoPause : this.labels.autoStart);
    autoplayIcon(autoplay, state.autoplay); autoplay.setAttribute("aria-pressed", String(state.autoplay));
    this.buttons.get("thumbnails")!.setAttribute("aria-pressed", String(!this.strip.hidden));
  }
  page(index: number, retry: () => void): HTMLElement {
    const shell = document.createElement("article"); shell.className = "br-page";
    shell.setAttribute("aria-label", formatLabel(this.labels.page, { page: index + 1 }));
    shell.setAttribute("aria-busy", "true");
    const loading = document.createElement("span"); loading.className = "br-loading"; loading.textContent = this.labels.loading;
    shell.append(loading); shell.addEventListener("br-retry", retry);
    return shell;
  }
  pageError(shell: HTMLElement, retry: () => void) {
    shell.setAttribute("aria-busy", "false");
    const text = document.createElement("p"); text.textContent = this.labels.pageError;
    const button = document.createElement("button"); button.type = "button"; button.textContent = this.labels.retry;
    button.addEventListener("click", retry); shell.replaceChildren(text, button);
  }
}
