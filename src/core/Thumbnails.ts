import type { PageSource, ReaderLabels } from "../types.js";
import { formatLabel } from "./model.js";

export class Thumbnails {
  private observer?: IntersectionObserver;
  private jobs = new Map<HTMLElement, AbortController>();
  private pending = new Set<HTMLElement>();
  private active = 0;
  private generation = 0;
  private start = -1;
  constructor(private host: HTMLElement, private source: PageSource, private labels: ReaderLabels, private go: (index: number) => void) {}
  show(page: number) {
    if (this.host.hidden) { this.clear(); return; }
    if (this.start < 0 || page < this.start || page >= this.start + 24) this.populate(page);
    for (const button of this.host.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute("aria-current", Number(button.dataset.page) === page ? "page" : "false");
    }
  }
  private populate(page: number) {
    this.clear(); this.start = Math.max(0, page - 6);
    if (typeof IntersectionObserver !== "undefined") this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (entry.isIntersecting) this.pending.add(target);
        else { this.pending.delete(target); this.jobs.get(target)?.abort(); this.jobs.delete(target); target.querySelector(".br-thumb-image")?.replaceChildren(); }
      }
      this.pump();
    }, { root: this.host, rootMargin: "120px" });
    for (let index = this.start; index < Math.min(this.source.pageCount, this.start + 24); index++) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.page = String(index);
      button.setAttribute("aria-label", formatLabel(this.labels.page, { page: index + 1 }));
      const image = document.createElement("div"); image.className = "br-thumb-image";
      image.style.aspectRatio = String(this.source.size.width / this.source.size.height);
      const label = document.createElement("span"); label.textContent = String(index + 1); button.append(image, label);
      button.addEventListener("click", () => this.go(index)); this.host.append(button);
      if (this.observer) this.observer.observe(button); else if (index < this.start + 3) this.pending.add(button);
    }
    this.pump();
  }
  private pump() {
    for (const button of this.pending) {
      if (this.active >= 2) break;
      this.pending.delete(button);
      if (this.jobs.has(button)) continue;
      const controller = new AbortController(); this.jobs.set(button, controller); this.active++;
      const generation = this.generation;
      const width = 100, height = width * this.source.size.height / this.source.size.width;
      const image = button.querySelector<HTMLElement>(".br-thumb-image")!;
      void this.source.renderPage(Number(button.dataset.page), image, { width, height, pixelRatio: 1, signal: controller.signal })
        .catch(() => { /* Keep the numbered thumbnail usable if its preview fails. */ })
        .finally(() => { if (generation === this.generation) { this.active--; this.pump(); } });
    }
  }
  clear() {
    this.generation++; this.observer?.disconnect(); this.observer = undefined;
    for (const controller of this.jobs.values()) controller.abort();
    this.jobs.clear(); this.pending.clear(); this.host.replaceChildren(); this.active = 0; this.start = -1;
  }
}
