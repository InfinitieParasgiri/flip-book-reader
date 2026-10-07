import { intervalMilliseconds } from "./model.js";

export class AutoTurn {
  enabled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private delay: number;
  constructor(seconds: number, private canRun: () => boolean, private atEnd: () => boolean,
    private turn: () => Promise<void>, private changed: (enabled: boolean) => void) {
    this.delay = intervalMilliseconds(seconds);
  }
  setInterval(seconds: number) { this.delay = intervalMilliseconds(seconds); this.reset(); }
  setEnabled(enabled: boolean) {
    this.enabled = enabled && !this.atEnd();
    this.changed(this.enabled);
    this.reset();
  }
  reset() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.enabled && this.canRun()) this.timer = setTimeout(async () => {
      this.timer = undefined;
      if (!this.enabled || !this.canRun()) return;
      if (this.atEnd()) { this.setEnabled(false); return; }
      await this.turn();
      if (this.atEnd()) this.setEnabled(false); else this.reset();
    }, this.delay);
  }
  destroy() { this.enabled = false; clearTimeout(this.timer); }
}
