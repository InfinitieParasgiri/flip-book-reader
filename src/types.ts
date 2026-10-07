import type english from "./locales/en.json";

export type ReaderLabels = typeof english;
export type PageSize = { width: number; height: number };
export type RenderOptions = PageSize & { pixelRatio: number; signal: AbortSignal };
export type PageSource = {
  pageCount: number;
  size: PageSize;
  renderPage(index: number, container: HTMLElement, options: RenderOptions): Promise<void>;
  destroy?(): void | Promise<void>;
};
export type ReaderState = {
  page: number; endPage: number; pageCount: number; spread: 1 | 2;
  zoom: number; turning: boolean; autoplay: boolean;
};
export type ReaderOptions = {
  title?: string; labels?: Partial<ReaderLabels>; language?: string; direction?: "ltr" | "rtl";
  initialPage?: number; spreadBreakpoint?: number; animationDuration?: number;
  autoTurnSeconds?: number; reducedMotion?: boolean; downloadUrl?: string; shareUrl?: string;
  onStateChange?(state: ReaderState): void; onError?(error: unknown): void; onClose?(): void;
  onDownload?(): void; onShare?(): void | Promise<void>;
};
export type ReaderAction = "previous" | "next" | "page" | "zoomIn" | "zoomOut" | "fit" |
  "fullscreen" | "autoplay" | "interval" | "thumbnails" | "close" | "download" | "share";
