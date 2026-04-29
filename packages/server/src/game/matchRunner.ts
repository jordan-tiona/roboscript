import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { tick as engineTick, buildInitialState } from "@roboscript/engine";
import type { GameState, BotCommand, GameEvent } from "@roboscript/engine";
import type { BotStateView, EnemyView } from "../runtime/RobotRuntime.js";

const TICK_DEADLINE_MS = 33; // ~1 tick at 30 TPS
const MAX_STALL_TICKS = 30;
const KEYFRAME_INTERVAL = 30;
const K_FACTOR = 32;

// Detect tsx dev mode — worker needs tsx loader injected
const isTsx = import.meta.url.endsWith(".ts");
const workerUrl = new URL(
  isTsx ? "./serverBotWorker.ts" : "./serverBotWorker.js",
  import.meta.url,
);
const workerPath = fileURLToPath(workerUrl);
const workerExecArgv = isTsx ? ["--import", "tsx/esm"] : [];

type WorkerMessage =
  | { type: "ready"; botId: string }
  | { type: "command"; tickId: number; botId: string; command: BotCommand }
  | { type: "error"; botId: string; message: string }
  | { type: "log"; botId: string; message: string; tick: number };

export interface MatchBotEntry {
  id: string;
  name: string;
  code: string;
  rating: number;
  entryId: string;
}

export interface MatchResult {
  winnerEntryId: string | null;
  durationTicks: number;
  ratingDelta: number;
  replay: ReplayData;
}

export interface ReplayData {
  arenaWidth: number;
  arenaHeight: number;
  obstacles: Array<Array<{ x: number; y: number }>>;
  botNames: Record<string, string>;
  keyframes: Array<{ tick: number; bots: unknown[]; bullets: unknown[]; zoneRadius: number }>;
  events: Array<{ tick: number; event: unknown }>;
}

interface LastKnownEntry {
  x: number; y: number; heading: number; energy: number; velocity: number; tick: number;
}

interface BotRunner {
  entry: MatchBotEntry;
  worker: Worker | null;
  pendingCommand: BotCommand | null;
  stallCount: number;
  crashed: boolean;
}

function eloExpected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

function computeDelta(ra: number, rb: number, score: number): number {
  return Math.round(K_FACTOR * (score - eloExpected(ra, rb)));
}

function buildBotStateView(bot: GameState["bots"][number]): BotStateView {
  return {
    x: bot.position.x, y: bot.position.y,
    heading: bot.heading, gunHeading: bot.gunHeading,
    energy: bot.energy, velocity: bot.velocity,
    gunHeat: bot.gunHeat, shield: bot.shield,
  };
}

function buildEnemyViews(
  state: GameState,
  observerId: string,
  lastKnown: Map<string, LastKnownEntry>,
): EnemyView[] {
  const visibleTargets = new Set(
    state.visibility.filter(p => p.observerId === observerId).map(p => p.targetId),
  );
  const firedThisTick = new Set<string>();
  for (const e of state.events) {
    if (e.type === "bulletFired") firedThisTick.add(e.botId);
  }

  return state.bots
    .filter(b => b.id !== observerId)
    .map((b): EnemyView => {
      const isVisible = visibleTargets.has(b.id);
      if (isVisible) {
        lastKnown.set(b.id, {
          x: b.position.x, y: b.position.y, heading: b.heading,
          energy: b.energy, velocity: b.velocity, tick: state.tick,
        });
      }
      const lk = lastKnown.get(b.id);
      return {
        id: b.id, name: b.name, alive: b.isAlive, visible: isVisible,
        lastSeen: lk ? state.tick - lk.tick : null,
        x: lk?.x ?? 0, y: lk?.y ?? 0, heading: lk?.heading ?? 0,
        energy: lk?.energy ?? 0, velocity: lk?.velocity ?? 0,
        firedThisTick: isVisible && firedThisTick.has(b.id),
      };
    });
}

function filterBotEvents(events: readonly GameEvent[], botId: string): readonly GameEvent[] {
  return events.filter(e => {
    if (e.type === "hitByBullet")  return e.victimId === botId;
    if (e.type === "hitWall")      return e.botId === botId;
    if (e.type === "hitObstacle")  return e.botId === botId;
    if (e.type === "bulletHit")    return e.ownerId === botId;
    if (e.type === "botDeath")     return e.botId === botId;
    if (e.type === "bulletMissed") return e.ownerId === botId;
    if (e.type === "zoneDamage")   return e.botId === botId;
    return false;
  });
}

async function initBotRunner(runner: BotRunner, state: GameState, botCount: number): Promise<void> {
  const worker = new Worker(workerPath, { execArgv: workerExecArgv });
  runner.worker = worker;

  const botState = state.bots.find(b => b.id === runner.entry.id)!;

  await new Promise<void>((resolve, reject) => {
    const onMessage = (msg: WorkerMessage) => {
      if (msg.type === "ready") {
        worker.off("message", onMessage);
        worker.off("error", onError);
        resolve();
      } else if (msg.type === "error") {
        worker.off("message", onMessage);
        worker.off("error", onError);
        runner.crashed = true;
        console.error(`[${runner.entry.name}] init error: ${msg.message}`);
        resolve(); // don't reject — crashed runner is handled gracefully
      }
    };
    const onError = (err: Error) => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      runner.crashed = true;
      console.error(`[${runner.entry.name}] worker error:`, err);
      resolve();
    };
    worker.on("message", onMessage);
    worker.on("error", onError);

    worker.postMessage({
      type: "init",
      botId: runner.entry.id,
      botName: runner.entry.name,
      botCount,
      code: runner.entry.code,
      initialState: buildBotStateView(botState),
      arenaWidth: state.arenaWidth,
      arenaHeight: state.arenaHeight,
      obstacles: state.obstacles.map(poly => poly.map(v => ({ x: v.x, y: v.y }))),
    });
  });

  if (!runner.crashed) {
    worker.on("message", (msg: WorkerMessage) => {
      if (msg.type === "command") {
        runner.pendingCommand = msg.command;
      } else if (msg.type === "error") {
        console.error(`[${runner.entry.name}] ${msg.message}`);
        runner.crashed = true;
      }
      // "log" messages are silently dropped server-side
    });
    worker.on("error", (err) => {
      console.error(`[${runner.entry.name}] worker error:`, err);
      runner.crashed = true;
    });
  }
}

export async function runMatch(botA: MatchBotEntry, botB: MatchBotEntry): Promise<MatchResult> {
  let state = buildInitialState(
    [{ id: botA.id, name: botA.name }, { id: botB.id, name: botB.name }],
    { obstacles: false },
  );

  const runners: BotRunner[] = [
    { entry: botA, worker: null, pendingCommand: null, stallCount: 0, crashed: false },
    { entry: botB, worker: null, pendingCommand: null, stallCount: 0, crashed: false },
  ];

  await Promise.all(runners.map(r => initBotRunner(r, state, runners.length)));

  const lastKnownMap = new Map<string, Map<string, LastKnownEntry>>();
  for (const runner of runners) {
    lastKnownMap.set(runner.entry.id, new Map());
  }

  const keyframes: ReplayData["keyframes"] = [];
  const allEvents: ReplayData["events"] = [];

  while (!state.isOver) {
    // Send tick to all alive bots simultaneously
    for (const runner of runners) {
      if (runner.crashed || !runner.worker) continue;
      const bot = state.bots.find(b => b.id === runner.entry.id)!;
      if (!bot.isAlive) continue;

      runner.pendingCommand = null;

      const enemies = buildEnemyViews(state, runner.entry.id, lastKnownMap.get(runner.entry.id)!);
      const botEvents = filterBotEvents(state.events, runner.entry.id);

      runner.worker.postMessage({
        type: "tick",
        tickId: state.tick,
        state: buildBotStateView(bot),
        enemies,
        events: botEvents,
        zoneRadius: state.zoneRadius,
      });
    }

    // Wait for commands, up to deadline
    await new Promise<void>(resolve => setTimeout(resolve, TICK_DEADLINE_MS));

    // Collect commands
    const commands: BotCommand[] = [];
    for (const runner of runners) {
      if (runner.crashed || !runner.worker) continue;
      const bot = state.bots.find(b => b.id === runner.entry.id)!;
      if (!bot.isAlive) continue;

      if (runner.pendingCommand) {
        commands.push(runner.pendingCommand);
        runner.pendingCommand = null;
        runner.stallCount = 0;
      } else {
        runner.stallCount++;
        if (runner.stallCount >= MAX_STALL_TICKS) {
          runner.crashed = true;
        }
      }
    }

    // Record replay data
    for (const e of state.events) {
      allEvents.push({ tick: state.tick, event: e });
    }
    if (state.tick % KEYFRAME_INTERVAL === 0) {
      keyframes.push({
        tick: state.tick,
        bots: state.bots.map(b => ({
          id: b.id, name: b.name,
          x: b.position.x, y: b.position.y,
          heading: b.heading, gunHeading: b.gunHeading,
          energy: b.energy, shield: b.shield,
          velocity: b.velocity, isAlive: b.isAlive,
        })),
        bullets: state.bullets.map(b => ({
          id: b.id, ownerId: b.ownerId,
          x: b.position.x, y: b.position.y,
          heading: b.heading, power: b.power,
        })),
        zoneRadius: state.zoneRadius,
      });
    }

    state = engineTick(state, commands);
  }

  // Terminate all workers
  for (const runner of runners) {
    runner.worker?.postMessage({ type: "terminate" });
    // Give worker a moment to exit cleanly, then force-terminate
    setTimeout(() => runner.worker?.terminate(), 500);
  }

  // Final keyframe
  keyframes.push({
    tick: state.tick,
    bots: state.bots.map(b => ({
      id: b.id, name: b.name,
      x: b.position.x, y: b.position.y,
      heading: b.heading, gunHeading: b.gunHeading,
      energy: b.energy, shield: b.shield,
      velocity: b.velocity, isAlive: b.isAlive,
    })),
    bullets: [],
    zoneRadius: state.zoneRadius,
  });

  // Determine winner
  const winnerBot = state.bots.find(b => b.id === state.winnerId);
  let winnerEntryId: string | null = null;
  let ratingDelta = 0;

  if (winnerBot) {
    const winnerRunner = runners.find(r => r.entry.id === winnerBot.id)!;
    const loserRunner  = runners.find(r => r.entry.id !== winnerBot.id)!;
    winnerEntryId = winnerRunner.entry.entryId;
    ratingDelta = Math.abs(computeDelta(winnerRunner.entry.rating, loserRunner.entry.rating, 1));
  } else {
    ratingDelta = Math.abs(computeDelta(botA.rating, botB.rating, 0.5));
  }

  const replay: ReplayData = {
    arenaWidth: state.arenaWidth,
    arenaHeight: state.arenaHeight,
    obstacles: state.obstacles.map(poly => poly.map(v => ({ x: v.x, y: v.y }))),
    botNames: { [botA.id]: botA.name, [botB.id]: botB.name },
    keyframes,
    events: allEvents,
  };

  return { winnerEntryId, durationTicks: state.tick, ratingDelta, replay };
}
