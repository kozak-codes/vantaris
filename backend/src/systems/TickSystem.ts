import { TICK_RATE_MS } from '@vantaris/shared/constants';

export class TickSystem {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentTick: number = 0;

  start(onTick: (tick: number) => void): void {
    this.interval = setInterval(() => {
      this.currentTick++;
      onTick(this.currentTick);
    }, TICK_RATE_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getCurrentTick(): number {
    return this.currentTick;
  }
}