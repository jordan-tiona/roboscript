import type { BotCommand, GameEvent } from "@roboscript/engine";

// ─── Main thread → Worker ─────────────────────────────────────────────────────

export type MainToWorker =
  | { type: "init"; botId: string; botName: string; code: string }
  | { type: "tick"; tickId: number; state: BotStateView; events: GameEvent[] }
  | { type: "terminate" };

// ─── Worker → Main thread ─────────────────────────────────────────────────────

export type WorkerToMain =
  | { type: "ready"; botId: string }
  | { type: "command"; tickId: number; botId: string; command: BotCommand }
  | { type: "error"; botId: string; message: string };

// ─── What user bot code can read about its own state ─────────────────────────

export interface BotStateView {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly gunHeading: number;
  readonly radarHeading: number;
  readonly energy: number;
  readonly velocity: number;
  readonly gunHeat: number;
}
