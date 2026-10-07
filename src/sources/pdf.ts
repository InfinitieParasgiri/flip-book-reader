import type { PageSource } from "../types.js";
import { validateSource } from "../core/model.js";

export type PdfViewport = { width: number; height: number };
export type PdfPage<V extends PdfViewport = PdfViewport> = {
  getViewport(options: { scale: number }): V;
  render(options: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: V }): { promise: Promise<void>; cancel(): void };
  cleanup(): boolean;
};
export type PdfDocument<V extends PdfViewport = PdfViewport> = { numPages: number; getPage(page: number): Promise<PdfPage<V>> };
/** Inject PDF.js's loading task: this adapter never imports or bundles PDF.js. */
export async function createPdfSource<V extends PdfViewport>(task: { promise: Promise<PdfDocument<V>>; destroy(): Promise<void> }, signal?: AbortSignal): Promise<PageSource> {
  let destroyed = false;
  const destroy = async () => { if (!destroyed) { destroyed = true; await task.destroy(); } };
  const onAbort = () => { void destroy().catch(() => {}); };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    signal?.throwIfAborted();
    const pdf = await task.promise;
    signal?.throwIfAborted();
    const first = await pdf.getPage(1); const size = first.getViewport({ scale: 1 });
    validateSource(pdf.numPages, size); first.cleanup();
    signal?.throwIfAborted();
    return { pageCount: pdf.numPages, size, destroy,
      renderPage: async (index, container, options) => {
        options.signal.throwIfAborted();
        if (destroyed || index < 0 || index >= pdf.numPages) throw new Error("Invalid PDF page");
        const page = await pdf.getPage(index + 1);
        options.signal.throwIfAborted();
        const base = page.getViewport({ scale: 1 });
        const fit = Math.min(options.width / base.width, options.height / base.height);
        const pixels = Math.min(options.pixelRatio, Math.sqrt(4_000_000 / (base.width * base.height * fit * fit)));
        const viewport = page.getViewport({ scale: fit * pixels });
        const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${base.width * fit}px`; canvas.style.height = `${base.height * fit}px`;
        const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
        const render = page.render({ canvasContext: context, canvas, viewport });
        const abort = () => render.cancel();
        options.signal.addEventListener("abort", abort, { once: true });
        try { options.signal.throwIfAborted(); await render.promise; options.signal.throwIfAborted(); container.replaceChildren(canvas); }
        finally { options.signal.removeEventListener("abort", abort); page.cleanup(); }
      } };
  } catch (error) { await destroy().catch(() => {}); throw error; }
  finally { signal?.removeEventListener("abort", onAbort); }
}
