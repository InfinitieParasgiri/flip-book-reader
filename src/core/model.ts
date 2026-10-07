import type { PageSize } from "../types.js";

export function validateSource(count: number, size: PageSize): void {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) throw new Error("Invalid book page count");
  if (![size.width, size.height].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid page dimensions");
}
export function spreadStart(page: number, count: number, spread: 1 | 2): number {
  const clamped = Math.max(0, Math.min(count - 1, Math.floor(Number.isFinite(page) ? page : 0)));
  return Math.floor(clamped / spread) * spread;
}
export function visiblePages(page: number, count: number, spread: 1 | 2): number[] {
  const start = spreadStart(page, count, spread);
  return Array.from({ length: Math.min(spread, count - start) }, (_, index) => start + index);
}
export function fitPages(width: number, height: number, size: PageSize, spread: 1 | 2): PageSize {
  const scale = Math.min(Math.max(1, width - 32) / (size.width * spread), Math.max(1, height - 32) / size.height);
  return { width: Math.max(1, size.width * scale), height: Math.max(1, size.height * scale) };
}
export function clampZoom(zoom: number): number {
  return Math.min(3, Math.max(1, Number.isFinite(zoom) ? Math.round(zoom * 100) / 100 : 1));
}
export function intervalMilliseconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) throw new Error("Auto-turn interval must be 1–3600 seconds");
  return seconds * 1000;
}
export function safeLink(value: string): string {
  const url = new URL(value, typeof document === "undefined" ? undefined : document.baseURI);
  if (!(["http:", "https:", "blob:"].includes(url.protocol))) throw new Error("Unsupported book URL");
  return value;
}
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
