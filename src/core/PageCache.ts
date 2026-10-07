import type { PageSource, PageSize } from "../types.js";

type Entry = { node: HTMLElement; controller: AbortController; ready: Promise<HTMLElement>; used: number };
export class PageCache {
  private entries = new Map<string, Entry>();
  private tick = 0;
  constructor(private source: PageSource, private limit = 4) {}
  async get(index: number, size: PageSize, density: number): Promise<HTMLElement> {
    const key = `${index}:${Math.round(size.width)}:${Math.round(size.height)}:${density}`;
    const existing = this.entries.get(key);
    if (existing) { existing.used = ++this.tick; return existing.ready; }
    const node = document.createElement("div"); node.className = "br-page-content";
    const controller = new AbortController();
    const entry: Entry = { node, controller, ready: Promise.resolve(node), used: ++this.tick };
    entry.ready = this.source.renderPage(index, node, { ...size, pixelRatio: density, signal: controller.signal }).then(() => {
      controller.signal.throwIfAborted(); return node;
    }).catch(error => { if (this.entries.get(key) === entry) this.entries.delete(key); throw error; });
    this.entries.set(key, entry);
    while (this.entries.size > this.limit) {
      const oldest = [...this.entries].sort((a, b) => a[1].used - b[1].used)[0];
      if (!oldest) break;
      oldest[1].controller.abort(); this.entries.delete(oldest[0]);
    }
    return entry.ready;
  }
  clear() { for (const entry of this.entries.values()) entry.controller.abort(); this.entries.clear(); }
}
export function snapshot(node: HTMLElement): HTMLElement {
  const result = node.cloneNode(true) as HTMLElement;
  const originals = node.querySelectorAll("canvas");
  result.querySelectorAll("canvas").forEach((canvas, index) => {
    const original = originals[index];
    if (original) { canvas.width = original.width; canvas.height = original.height; canvas.getContext("2d")?.drawImage(original, 0, 0); }
  });
  return result;
}
