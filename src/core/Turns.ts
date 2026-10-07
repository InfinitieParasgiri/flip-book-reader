import type { PageSize } from "../types.js";
import { spreadStart, visiblePages } from "./model.js";
import { FlipSheet } from "./flip.js";
import type { Corner, Point } from "./foldGeometry.js";
import { Renderer, type PreparedPages } from "./Renderer.js";

type Context = { page: number; count: number; spread: 1 | 2; size: PageSize; zoom: number; rtl: boolean; reducedMotion: boolean; duration: number };
type Turn = { target: number; prepared: PreparedPages; sheet?: FlipSheet; controller: AbortController; start?: Point; started: number; maxProgress: number; finishing: boolean };
export class Turns {
  private current?: Turn;
  private queued?: { target: number; resolve(): void };
  constructor(private stage: HTMLElement, private renderer: Renderer, private context: () => Context,
    private changed: (turning: boolean) => void, private commit: (page: number) => void) {}
  next() { const context = this.context(); return this.goTo((this.current?.target ?? context.page) + context.spread); }
  previous() { const context = this.context(); return this.goTo((this.current?.target ?? context.page) - context.spread); }
  async goTo(index: number): Promise<void> {
    const context = this.context(), target = spreadStart(index, context.count, context.spread);
    if (this.current) {
      if (target === this.current.target) return;
      this.queued?.resolve();
      return new Promise(resolve => { this.queued = { target, resolve }; });
    }
    if (target === context.page) return;
    const turn = this.begin(target, "bottom"); await this.finish(turn, true);
  }
  private begin(target: number, corner: Corner): Turn {
    const context = this.context(), forward = target > context.page;
    const old = [...this.stage.querySelectorAll<HTMLElement>(":scope > .br-page")];
    const prepared = this.renderer.prepare(visiblePages(target, context.count, context.spread), context.size, context.zoom);
    const turn: Turn = { target, prepared, controller: new AbortController(), started: performance.now(), maxProgress: 0, finishing: false };
    this.current = turn; this.changed(true);
    const from = old[forward ? context.spread - 1 : 0];
    if (!context.reducedMotion && context.zoom === 1 && from) {
      turn.sheet = new FlipSheet(this.stage, from, prepared.pages, forward, context.rtl, context.spread, corner);
      void prepared.ready.then(() => { if (this.current === turn) turn.sheet?.updatePages(prepared.pages); });
    }
    return turn;
  }
  beginDrag(point: Point): boolean {
    const context = this.context(); if (this.current || context.zoom !== 1 || context.reducedMotion) return false;
    const rect = this.stage.getBoundingClientRect(), width = rect.width / context.spread;
    const x = point.x - rect.left, y = point.y - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return false;
    const right = x >= (context.spread === 2 ? width : width / 2), localX = right ? x - (rect.width - width) : width - x;
    if (localX < width * .65 || (y > rect.height * .25 && y < rect.height * .75)) return false;
    const forward = right !== context.rtl, target = spreadStart(context.page + (forward ? context.spread : -context.spread), context.count, context.spread);
    if (target === context.page) return false;
    const turn = this.begin(target, y < rect.height / 2 ? "top" : "bottom"); turn.start = point;
    return Boolean(turn.sheet);
  }
  moveDrag(point: Point) {
    const turn = this.current; if (!turn?.sheet || !turn.start || turn.finishing) return;
    const sheet = turn.sheet;
    sheet.update({ x: sheet.width + (point.x - turn.start.x) * (sheet.right ? 1 : -1),
      y: (sheet.corner === "top" ? 0 : sheet.height) + point.y - turn.start.y });
    turn.maxProgress = Math.max(turn.maxProgress, sheet.progress);
  }
  endDrag(allowCommit: boolean, immediate = false) {
    const turn = this.current; if (!turn?.start || turn.finishing) return;
    const progress = turn.sheet?.progress ?? 0;
    const flick = progress > .04 && performance.now() - turn.started < 300;
    const click = turn.maxProgress < .01;
    void this.finish(turn, allowCommit && (progress >= .18 || flick || click), immediate);
  }
  private async finish(turn: Turn, commit: boolean, immediate = false) {
    if (turn.finishing) return; turn.finishing = true;
    const context = this.context();
    const completed = turn.sheet ? await turn.sheet.finish(commit, immediate ? 0 : context.duration, turn.controller.signal) : commit;
    if (this.current !== turn) return;
    turn.sheet?.destroy(); this.current = undefined;
    if (completed) { this.renderer.mount(turn.prepared.pages); this.commit(turn.target); }
    else this.renderer.invalidate();
    this.changed(false);
    const queued = this.queued; this.queued = undefined;
    if (queued) { try { await this.goTo(queued.target); } finally { queued.resolve(); } }
  }
  cancel() {
    const current = this.current; this.current = undefined;
    current?.controller.abort(); current?.sheet?.destroy();
    this.queued?.resolve(); this.queued = undefined; this.changed(false);
  }
}
