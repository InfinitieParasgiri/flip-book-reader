import english from "../locales/en.json" with { type: "json" };
import type { ReaderLabels } from "../types.js";
export function readerLabels(translated?: Partial<ReaderLabels>): ReaderLabels {
  const labels = { ...english };
  for (const key of Object.keys(labels) as (keyof ReaderLabels)[]) {
    const value = translated?.[key];
    if (typeof value === "string" && value.trim()) labels[key] = value;
  }
  return labels;
}
