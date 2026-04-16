import { ARENA_WIDTH, ARENA_HEIGHT } from "@roboscript/engine";
import { CANVAS_PADDING } from "./renderer.js";
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
  private onGameOver: (() => void) | null = null;
  private countdown: number | null = null;

  constructor(canvas: HTMLCanvasElement, bots: BotEntry[], onGameOver?: () => void) {
    this.onGameOver = onGameOver ?? null;
    this.driver = new GameDriver(bots);
    this.canvas = canvas;
    this.canvas.width = ARENA_WIDTH + CANVAS_PADDING * 2;
    this.canvas.height = ARENA_HEIGHT + CANVAS_PADDING * 2;
    this.ctx = canvas.getContext("2d")!;
  }

  async start(bots: BotEntry[]): Promise<void> {
    this.running = true;
    await this.driver.start(bots);

    // Show initial state immediately so bots are visible during countdown
    this.latestState = this.driver.getState();

    // Render loop — starts now so the arena is live during countdown
    const frame = () => {
      if (this.latestState) {
        renderFrame(this.ctx, this.latestState, this.canvas.width, this.canvas.height);
        if (this.countdown !== null) this.renderCountdown(this.countdown);
      }
      if (this.running || this.latestState?.isOver) {
        this.rafId = requestAnimationFrame(frame);
      }
    };
    this.rafId = requestAnimationFrame(frame);

    // Countdown: 3 → 2 → 1, one second each
    for (let i = 3; i >= 1; i--) {
      this.countdown = i;
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
    this.countdown = null;

    // Game tick loop — fixed rate
    this.tickTimer = setInterval(() => {
      if (!this.running) return;
      if (this.driver.getState().isOver) {
        this.stopTicking();
        this.running = false;
        this.onGameOver?.();
        return;
      }
      this.driver.runTick((s) => { this.latestState = s; }).catch(console.error);
    }, 1000 / TICKS_PER_SECOND);
  }

  private renderCountdown(value: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.font = "bold 96px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    // Shadow for readability
    this.ctx.fillStyle = "rgba(0,0,0,0.45)";
    this.ctx.fillText(String(value), w / 2 + 3, h / 2 + 3);
    // Number
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(String(value), w / 2, h / 2);
    this.ctx.textBaseline = "alphabetic";
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
