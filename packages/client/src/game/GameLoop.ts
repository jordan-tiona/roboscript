import { ARENA_WIDTH, ARENA_HEIGHT } from "@roboscript/engine";
import type { GameState } from "@roboscript/engine";
import { GameDriver } from "./GameDriver.js";
import type { BotEntry } from "./GameDriver.js";
import { renderFrame } from "./renderer.js";
import { TICKS_PER_SECOND } from "@roboscript/engine";

export class GameLoop {
  private driver: GameDriver;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private latestState: GameState | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement, bots: BotEntry[]) {
    this.driver = new GameDriver(bots);
    this.canvas = canvas;
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = canvas.getContext("2d")!;
  }

  async start(bots: BotEntry[]): Promise<void> {
    this.running = true;
    await this.driver.start(bots);

    // Game tick loop — fixed rate
    this.tickTimer = setInterval(() => {
      if (!this.running) return;
      if (this.driver.getState().isOver) {
        this.stopTicking();
        return;
      }
      this.driver.runTick((s) => { this.latestState = s; }).catch(console.error);
    }, 1000 / TICKS_PER_SECOND);

    // Render loop — display refresh rate
    const frame = () => {
      if (this.latestState) {
        renderFrame(this.ctx, this.latestState, this.canvas.width, this.canvas.height);
      }
      if (this.running || this.latestState?.isOver) {
        this.rafId = requestAnimationFrame(frame);
      }
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private stopTicking(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  stop(): void {
    this.running = false;
    this.stopTicking();
    cancelAnimationFrame(this.rafId);
    this.driver.stop();
  }
}
