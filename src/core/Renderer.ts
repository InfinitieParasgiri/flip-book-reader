import type { PageSource, PageSize } from "../types.js";
import { PageCache, snapshot } from "./PageCache.js";
import { ReaderView } from "./View.js";

export type PreparedPages = { pages: HTMLElement[]; ready: Promise<void>; isCurrent(): boolean };
export class Renderer {
  private cache: PageCache;
  private generation = 0;
  private warmTimer?: ReturnType<typeof setTimeout>;
  constructor(source: PageSource, private view: ReaderView, private report: (error: unknown) => void) { this.cache = new PageCache(source); }
  prepare(indices: number[], size: PageSize, zoom: number): PreparedPages {
    const generation = ++this.generation; clearTimeout(this.warmTimer);
    const renderSize = { width: size.width * zoom, height: size.height * zoom }, density = Math.min(2, window.devicePixelRatio || 1);
    const pages = indices.map(index => this.view.page(index, () => {}));
    const ready = Promise.all(pages.map(async (shell, offset) => {
      const index = indices[offset]!;
      const apply = (content: HTMLElement) => { shell.replaceChildren(snapshot(content)); shell.setAttribute("aria-busy", "false"); };
      const cached = this.cache.peek(index, renderSize, density);
      if (cached) { apply(cached); return; }
      const load = async () => {
        shell.setAttribute("aria-busy", "true");
        try {
          const content = await this.cache.get(index, renderSize, density);
          if (generation === this.generation) apply(content);
        } catch (error) {
          if (generation !== this.generation || (error instanceof DOMException && error.name === "AbortError")) return;
          this.view.pageError(shell, () => { void load(); }); this.report(error);
        }
      };
      await load();
    })).then(() => {});
    return { pages, ready, isCurrent: () => generation === this.generation };
  }
  mount(pages: HTMLElement[]) { this.view.stage.replaceChildren(...pages); }
  pages(indices: number[], size: PageSize, zoom: number): Promise<void> {
    const prepared = this.prepare(indices, size, zoom); this.mount(prepared.pages); return prepared.ready;
  }
  warm(indices: number[], size: PageSize, zoom: number) {
    clearTimeout(this.warmTimer); if (zoom !== 1) return;
    const generation = this.generation, density = Math.min(2, window.devicePixelRatio || 1);
    this.warmTimer = setTimeout(() => {
      const load = async () => {
        for (const index of indices) {
          if (generation !== this.generation) return;
          try { await this.cache.get(index, size, density); } catch { /* A failed preview must not block the reader. */ }
        }
      };
      void load();
    }, 60);
  }
  invalidate(clear = false) { this.generation++; clearTimeout(this.warmTimer); if (clear) this.cache.clear(); }
  destroy() { this.invalidate(true); }
}
