import type { ReaderAction } from "../types.js";
const paths: Partial<Record<ReaderAction, string>> = {
  previous: "m14 5-7 7 7 7", next: "m10 5 7 7-7 7",
  zoomIn: "M11 7v8M7 11h8M20 20l-4-4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  zoomOut: "M7 11h8M20 20l-4-4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  fit: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M8 8h8v8H8z",
  fullscreen: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6",
  thumbnails: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  autoplay: "m8 4 12 8-12 8z", close: "m5 5 14 14M5 19 19 5",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  share: "M16 5 8 10M8 14l8 5M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};
export function icon(action: ReaderAction): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", paths[action] ?? ""); svg.append(path); return svg;
}
export function buttonLabel(button: HTMLButtonElement, text: string) {
  button.title = text; button.setAttribute("aria-label", text);
  const label = button.querySelector("span"); if (label) label.textContent = text;
}
export function autoplayIcon(button: HTMLButtonElement, paused: boolean) {
  button.querySelector("path")?.setAttribute("d", paused ? "M8 4v16M16 4v16" : paths.autoplay!);
}
