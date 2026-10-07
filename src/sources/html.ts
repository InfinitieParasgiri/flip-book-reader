import type { PageSource, PageSize } from "../types.js";
import { validateSource } from "../core/model.js";

export function createHtmlSource(pages: (() => HTMLElement)[], size: PageSize): PageSource {
  validateSource(pages.length, size);
  const input = [...pages];
  return { pageCount: input.length, size, renderPage: async (index, container, { signal, width, height }) => {
    signal.throwIfAborted();
    const factory = input[index]; if (!factory) throw new Error("Invalid HTML page");
    const page = factory(); page.classList.add("br-html-page");
    page.style.transform = `scale(${Math.min(width / size.width, height / size.height)})`;
    page.style.width = `${size.width}px`; page.style.height = `${size.height}px`;
    const wrapper = document.createElement("div"); wrapper.className = "br-html-scale";
    container.append(wrapper); wrapper.append(page);
  } };
}
