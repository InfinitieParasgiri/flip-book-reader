"use client";

import { useEffect, useRef, useState } from "react";
import { BookReader } from "./BookReader.js";
import { readerLabels } from "./core/labels.js";
import type { PageSource, ReaderOptions } from "./types.js";

export type ReactBookReaderProps = {
  /** Keep this function stable with useCallback. A fresh source is owned by each mount. */
  createSource(signal: AbortSignal): PageSource | Promise<PageSource>;
  /** Keep options stable with useMemo to avoid reopening the book. */
  options?: ReaderOptions;
  className?: string;
  onReady?(reader: BookReader): void;
};
export function ReactBookReader({ createSource, options, className, onReady }: ReactBookReaderProps) {
  const host = useRef<HTMLDivElement>(null);
  const readyCallback = useRef(onReady);
  const [loaded, setLoaded] = useState<{ factory: typeof createSource; options: typeof options; attempt: number; status: "ready" | "error" }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { readyCallback.current = onReady; }, [onReady]);
  useEffect(() => {
    const controller = new AbortController(); let reader: BookReader | undefined; let source: PageSource | undefined;
    let cleaned = false;
    const release = async () => { if (!cleaned && source) { cleaned = true; await source.destroy?.(); } };
    const load = async () => {
      try {
        source = await createSource(controller.signal);
        if (controller.signal.aborted || !host.current) { await release(); return; }
        reader = new BookReader(host.current, source, options);
        setLoaded({ factory: createSource, options, attempt, status: "ready" }); readyCallback.current?.(reader);
      } catch (error) {
        reader?.destroy(); await release().catch(() => {});
        if (!controller.signal.aborted) { setLoaded({ factory: createSource, options, attempt, status: "error" }); options?.onError?.(error); }
      }
    };
    void load();
    return () => { controller.abort(); reader?.destroy(); void release().catch(() => {}); };
  }, [createSource, options, attempt]);
  const status = loaded?.factory === createSource && loaded.options === options && loaded.attempt === attempt ? loaded.status : "loading";
  const labels = readerLabels(options?.labels);
  return <div className={className}>
    {status === "loading" && <div role="status">{labels.loading}</div>}
    {status === "error" && <div role="alert"><p>{labels.loadError}</p><button type="button" onClick={() => { setAttempt(value => value + 1); }}>{labels.retry}</button></div>}
    <div ref={host} />
  </div>;
}
