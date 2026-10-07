import type { PageSource, PageSize } from "../types.js";
import { PageCache, snapshot } from "./PageCache.js";
import { ReaderView } from "./View.js";

export class Renderer {
  private cache: PageCache;
  private generation = 0;
  constructor(private source: PageSource, private view: ReaderView, private report: (error: unknown) => void) { this.cache = new PageCache(source); }
  async pages(indices: number[], size: PageSize, zoom: number): Promise<HTMLElement[]> {
    const generation = ++this.generation;
    const pages = indices.map(index => this.view.page(index, () => {}));
    this.view.stage.replaceChildren(...pages);
    await Promise.all(pages.map(async (shell, offset) => {
      const index = indices[offset]!;
      const load = async () => {
        shell.setAttribute("aria-busy", "true");
        try {
          const content = await this.cache.get(index, { width: size.width * zoom, height: size.height * zoom }, Math.min(2, window.devicePixelRatio || 1));
          if (generation !== this.generation) return;
          shell.replaceChildren(snapshot(content)); shell.setAttribute("aria-busy", "false");
        } catch (error) {
          if (generation !== this.generation || (error instanceof DOMException && error.name === "AbortError")) return;
          this.view.pageError(shell, () => { void load(); }); this.report(error);
        }
      };
      await load();
    }));
    return pages;
  }
  invalidate() { this.generation++; }
  destroy() { this.invalidate(); this.cache.clear(); }
}
