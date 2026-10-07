import { snapshot } from "./PageCache.js";

/** A sheet has two real faces and turns around its binding using native 3D transforms. */
export async function animateFlip(stage: HTMLElement, oldPages: HTMLElement[], newPages: HTMLElement[],
  forward: boolean, rtl: boolean, spread: 1 | 2, duration: number, signal: AbortSignal): Promise<void> {
  if (!duration || signal.aborted) return;
  const from = forward ? oldPages[spread - 1] : oldPages[0];
  const to = forward ? newPages[0] : newPages[spread - 1];
  if (!from && !to) return;
  const sheet = document.createElement("div"); sheet.className = "br-sheet"; sheet.setAttribute("aria-hidden", "true");
  const right = forward !== rtl;
  sheet.style.width = `${100 / spread}%`; sheet.style.left = right ? `${100 - 100 / spread}%` : "0";
  sheet.style.transformOrigin = right ? "left center" : "right center";
  const front = document.createElement("div"); front.className = "br-sheet-face br-sheet-front";
  const back = document.createElement("div"); back.className = "br-sheet-face br-sheet-back";
  if (from) front.append(snapshot(from)); if (to) back.append(snapshot(to));
  const stationary = spread === 2 ? oldPages[forward ? 0 : 1] : undefined;
  const base = document.createElement("div"); base.className = "br-stationary"; base.setAttribute("aria-hidden", "true");
  base.style.width = `${100 / spread}%`; base.style.left = right ? "0" : "50%";
  if (stationary) { base.append(snapshot(stationary)); stage.append(base); }
  sheet.append(front, back); stage.append(sheet);
  if (to) to.style.visibility = "hidden";
  const angle = right ? -180 : 180;
  const animation = sheet.animate([
    { transform: "rotateY(0deg)", filter: "brightness(1)" },
    { transform: `rotateY(${angle / 2}deg)`, filter: "brightness(.8)", offset: .5 },
    { transform: `rotateY(${angle}deg)`, filter: "brightness(1)" },
  ], { duration, easing: "cubic-bezier(.3,.05,.25,1)", fill: "forwards" });
  const abort = () => animation.cancel(); signal.addEventListener("abort", abort, { once: true });
  try { await animation.finished; } catch { /* Resizing or closing cancels the sheet. */ }
  finally { signal.removeEventListener("abort", abort); animation.cancel(); sheet.remove(); base.remove(); if (to) to.style.visibility = ""; }
}
