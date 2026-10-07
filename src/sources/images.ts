import type { PageSource, PageSize } from "../types.js";
import { safeLink, validateSource } from "../core/model.js";

export function createImageSource(pages: { src: string; alt?: string }[], size: PageSize): PageSource {
  validateSource(pages.length, size);
  const input = pages.map(page => ({ ...page, src: safeLink(page.src) }));
  return { pageCount: input.length, size, renderPage: async (index, container, { signal }) => {
    const page = input[index]; if (!page) throw new Error("Invalid image page");
    signal.throwIfAborted();
    const image = new Image(); image.className = "br-page-image"; image.alt = page.alt ?? "";
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); image.removeAttribute("src"); reject(new Error("Image page timed out")); }, 20000);
      const cleanup = () => { clearTimeout(timeout); image.onload = null; image.onerror = null; signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); image.removeAttribute("src"); reject(signal.reason); };
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error("Image page unavailable")); };
      signal.addEventListener("abort", abort, { once: true }); image.src = page.src;
    });
    signal.throwIfAborted(); container.replaceChildren(image);
  } };
}
