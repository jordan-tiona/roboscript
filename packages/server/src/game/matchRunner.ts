import { tick as engineTick, buildInitialState } from "@roboscript/engine";
import type { GameState, BotCommand, GameEvent } from "@roboscript/engine";
import { RobotRuntime } from "../runtime/RobotRuntime.js";
import type { BotStateView, EnemyView } from "../runtime/RobotRuntime.js";

const TICK_DEADLINE_MS = 10;
const MAX_STALL_TICKS = 30;
const KEYFRAME_INTERVAL = 30;
const K_FACTOR = 32;

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
  runtime: RobotRuntime | null;
  pendingCommand: BotCommand | null;
  commandResolve: (() => void) | null;
  stallCount: number;
  crashed: boolean;
}

function eloExpected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

function computeDelta(ra: number, rb: number, score: number): number {
  return Math.round(K_FACTOR * (score - eloExpected(ra, rb)));
}

const yieldToMicrotasks = () => new Promise<void>(resolve => setImmediate(resolve));

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

function initBotRunner(runner: BotRunner, state: GameState): void {
  const botState = state.bots.find(b => b.id === runner.entry.id)!;

  const classMatch = runner.entry.code.match(/class\s+(\w+)\s+extends\s+(?:Robot|RobotRuntime)\b/);
  const className = classMatch?.[1] ?? "MyRobot";

  let bot: RobotRuntime;
  try {
    const factory = new Function(
      "Robot", "RobotRuntime",
      `"use strict";\n${runner.entry.code}\nif (typeof ${className} === 'undefined') { throw new Error('Bot must extend Robot'); } return new ${className}();`,
    );
    bot = factory(RobotRuntime, RobotRuntime) as RobotRuntime;
  } catch (e) {
    console.error(`[${runner.entry.name}] init error:`, e);
    runner.crashed = true;
    return;
  }

  bot._init(
    runner.entry.id,
    2,
    (cmd) => {
      runner.pendingCommand = cmd;
      runner.commandResolve?.();
      runner.commandResolve = null;
    },
    buildBotStateView(botState),
    state.arenaWidth, state.arenaHeight,
    state.obstacles.map(poly => poly.map(v => ({ x: v.x, y: v.y }))),
  );

  runner.runtime = bot;
  bot.run().catch(e => {
    console.error(`[${runner.entry.name}] runtime error:`, e);
    runner.crashed = true;
  });
}

export async function runMatch(botA: MatchBotEntry, botB: MatchBotEntry): Promise<MatchResult> {
  let state = buildInitialState(
    [{ id: botA.id, name: botA.name }, { id: botB.id, name: botB.name }],
    { obstacles: false },
  );

  const runners: BotRunner[] = [
    { entry: botA, runtime: null, pendingCommand: null, commandResolve: null, stallCount: 0, crashed: false },
    { entry: botB, runtime: null, pendingCommand: null, commandResolve: null, stallCount: 0, crashed: false },
  ];

  for (const runner of runners) {
    initBotRunner(runner, state);
  }

  // Yield so all bot coroutines can start and reach their first suspension point
  await yieldToMicrotasks();

  const lastKnownMap = new Map<string, Map<string, LastKnownEntry>>();
  for (const runner of runners) {
    lastKnownMap.set(runner.entry.id, new Map());
  }

  const keyframes: ReplayData["keyframes"] = [];
  const allEvents: ReplayData["events"] = [];

  while (!state.isOver) {
    // Trigger all alive bots simultaneously
    for (const runner of runners) {
      if (runner.crashed || !runner.runtime) continue;
      const bot = state.bots.find(b => b.id === runner.entry.id)!;
      if (!bot.isAlive) continue;

      const enemies = buildEnemyViews(state, runner.entry.id, lastKnownMap.get(runner.entry.id)!);
      const botEvents = filterBotEvents(state.events, runner.entry.id);

      runner.runtime._receiveTick(state.tick, buildBotStateView(bot), enemies, botEvents, state.zoneRadius);
    }

    // Yield: all bot microtasks complete before setImmediate fires
    const deadline = new Promise<void>(resolve => setTimeout(resolve, TICK_DEADLINE_MS));
    await Promise.race([yieldToMicrotasks(), deadline]);

    // Collect commands
    const commands: BotCommand[] = [];
    for (const runner of runners) {
      if (runner.crashed || !runner.runtime) continue;
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
    // Draw — small rating exchange
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
