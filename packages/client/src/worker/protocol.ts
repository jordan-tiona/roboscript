import type { BotCommand, GameEvent } from "@roboscript/engine";

// ─── Main thread → Worker ─────────────────────────────────────────────────────

export type MainToWorker =
  | { type: "init"; botId: string; botName: string; botCount: number; code: string }
  | { type: "tick"; tickId: number; state: BotStateView; enemies: EnemyView[]; events: GameEvent[] }
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
  readonly energy: number;
  readonly velocity: number;
  readonly gunHeat: number;
}

// ─── Per-enemy view sent to each bot each tick ────────────────────────────────
//
// Always present for every non-self bot. When visible: false, position/heading/
// energy/velocity reflect the last known state. Check lastSeen before relying
// on stale data; null means this enemy has never been observed.

export interface EnemyView {
  readonly id: string;
  readonly name: string;
  readonly alive: boolean;
  readonly visible: boolean;
  readonly lastSeen: number | null;  // ticks ago; null = never seen
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly energy: number;
  readonly velocity: number;
}
