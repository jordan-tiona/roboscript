import { tick, buildInitialState } from "@roboscript/engine";
import type { GameState, BotCommand, BuildOptions } from "@roboscript/engine";
import type { MainToWorker, WorkerToMain, EnemyView } from "../worker/protocol.js";

const TICK_DEADLINE_MS = 50;  // max ms to wait for a bot command per tick
const MAX_STALL_TICKS = 30;   // consecutive stalls before bot is terminated

export interface BotEntry {
  id: string;
  name: string;
  code: string;
}

export type LogCallback = (botName: string, message: string, tick: number) => void;

interface LastKnownEntry {
  x: number;
  y: number;
  heading: number;
  energy: number;
  velocity: number;
  tick: number;
}

export class GameDriver {
  private state: GameState;
  private workers = new Map<string, Worker>();
  private stallCounts = new Map<string, number>();
  private pendingCommands = new Map<string, BotCommand>();
  private tickResolvers = new Map<string, (cmd: BotCommand | null) => void>();
  // lastKnown[observerId][targetId] = last observed state
  private lastKnown = new Map<string, Map<string, LastKnownEntry>>();
  private onLog: LogCallback | undefined;

  constructor(bots: BotEntry[], onLog?: LogCallback, arenaOptions?: BuildOptions) {
    this.state = buildInitialState(bots.map((b) => ({ id: b.id, name: b.name })), arenaOptions);
    this.onLog = onLog;
  }

  start(bots: BotEntry[]): Promise<void> {
    const readyPromises: Promise<void>[] = [];

    for (const bot of bots) {
      const worker = new Worker(
        new URL("../worker/botWorker.ts", import.meta.url),
        { type: "module" },
      );
      this.workers.set(bot.id, worker);
      this.stallCounts.set(bot.id, 0);
      this.lastKnown.set(bot.id, new Map());

      const readyPromise = new Promise<void>((resolve) => {
        worker.onmessage = (evt: MessageEvent<WorkerToMain>) => {
          const msg = evt.data;

          if (msg.type === "ready") {
            worker.onmessage = (e: MessageEvent<WorkerToMain>) =>
              this.handleWorkerMessage(e.data);
            resolve();
            return;
          }
          if (msg.type === "error") {
            console.error(`[${msg.botId}] init error:`, msg.message);
            resolve();
          }
        };
      });

      worker.onerror = (e) => console.error(`Worker error for ${bot.id}:`, e);

      const botState = this.state.bots.find((b) => b.id === bot.id)!;
      const initMsg: MainToWorker = {
        type: "init",
        botId: bot.id,
        botName: bot.name,
        botCount: bots.length,
        code: bot.code,
        initialState: {
          x: botState.position.x,
          y: botState.position.y,
          heading: botState.heading,
          gunHeading: botState.gunHeading,
          energy: botState.energy,
          velocity: botState.velocity,
          gunHeat: botState.gunHeat,
          shield: botState.shield,
        },
        arenaWidth: this.state.arenaWidth,
        arenaHeight: this.state.arenaHeight,
        obstacles: this.state.obstacles.map(poly => poly.map(v => ({ x: v.x, y: v.y }))),
      };
      worker.postMessage(initMsg);
      readyPromises.push(readyPromise);
    }

    return Promise.all(readyPromises).then(() => undefined);
  }

  private handleWorkerMessage(msg: WorkerToMain): void {
    if (msg.type === "command") {
      const resolve = this.tickResolvers.get(msg.botId);
      if (resolve) {
        this.tickResolvers.delete(msg.botId);
        resolve(msg.command);
      }
    }
    if (msg.type === "log") {
      const botName = this.state.bots.find((b) => b.id === msg.botId)?.name ?? msg.botId;
      this.onLog?.(botName, msg.message, msg.tick);
    }
    if (msg.type === "error") {
      console.error(`[${msg.botId}] runtime error:`, msg.message);
    }
  }

  private buildEnemyViews(observerId: string): EnemyView[] {
    const known = this.lastKnown.get(observerId) ?? new Map<string, LastKnownEntry>();
    const visibleTargets = new Set(
      this.state.visibility
        .filter((p) => p.observerId === observerId)
        .map((p) => p.targetId),
    );

    // Bots that fired this tick (visible muzzle flash)
    const firedThisTick = new Set<string>();
    for (const e of this.state.events) {
      if (e.type === "bulletFired") firedThisTick.add(e.botId);
    }

    return this.state.bots
      .filter((b) => b.id !== observerId)
      .map((b): EnemyView => {
        const isVisible = visibleTargets.has(b.id);

        if (isVisible) {
          // Update last known
          known.set(b.id, {
            x: b.position.x,
            y: b.position.y,
            heading: b.heading,
            energy: b.energy,
            velocity: b.velocity,
            tick: this.state.tick,
          });
        }

        const lk = known.get(b.id);
        return {
          id: b.id,
          name: b.name,
          alive: b.isAlive,
          visible: isVisible,
          lastSeen: lk ? this.state.tick - lk.tick : null,
          x: lk?.x ?? 0,
          y: lk?.y ?? 0,
          heading: lk?.heading ?? 0,
          energy: lk?.energy ?? 0,
          velocity: lk?.velocity ?? 0,
          firedThisTick: isVisible && firedThisTick.has(b.id),
        };
      });
  }

  async runTick(onState: (s: GameState) => void): Promise<void> {
    const tickId = this.state.tick;
    const commandPromises: Promise<void>[] = [];

    for (const bot of this.state.bots) {
      if (!bot.isAlive) continue;
      const worker = this.workers.get(bot.id);
      if (!worker) continue;

      const botEvents = this.state.events.filter((e) => {
        if (e.type === "hitByBullet") return e.victimId === bot.id;
        if (e.type === "hitWall") return e.botId === bot.id;
        if (e.type === "bulletHit") return e.ownerId === bot.id;
        if (e.type === "botDeath") return e.botId === bot.id;
        if (e.type === "bulletMissed") return e.ownerId === bot.id;
        return false;
      });

      const tickMsg: MainToWorker = {
        type: "tick",
        tickId,
        state: {
          x: bot.position.x,
          y: bot.position.y,
          heading: bot.heading,
          gunHeading: bot.gunHeading,
          energy: bot.energy,
          velocity: bot.velocity,
          gunHeat: bot.gunHeat,
          shield: bot.shield,
        },
        enemies: this.buildEnemyViews(bot.id),
        events: botEvents,
      };
      worker.postMessage(tickMsg);

      const p = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.tickResolvers.delete(bot.id);
          const stalls = (this.stallCounts.get(bot.id) ?? 0) + 1;
          this.stallCounts.set(bot.id, stalls);
          if (stalls >= MAX_STALL_TICKS) this.terminateBot(bot.id);
          resolve();
        }, TICK_DEADLINE_MS);

        this.tickResolvers.set(bot.id, (cmd) => {
          clearTimeout(timeout);
          this.stallCounts.set(bot.id, 0);
          if (cmd) this.pendingCommands.set(bot.id, cmd);
          resolve();
        });
      });
      commandPromises.push(p);
    }

    await Promise.all(commandPromises);

    const commands = [...this.pendingCommands.values()];
    this.pendingCommands.clear();
    this.state = tick(this.state, commands);
    onState(this.state);
  }

  private terminateBot(botId: string): void {
    const worker = this.workers.get(botId);
    if (worker) {
      worker.terminate();
      this.workers.delete(botId);
    }
  }

  stop(): void {
    for (const [, worker] of this.workers) worker.terminate();
    this.workers.clear();
    this.tickResolvers.clear();
    this.pendingCommands.clear();
  }

  getState(): GameState {
    return this.state;
  }
}
