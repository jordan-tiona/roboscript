import type { GameState, BotCommand, GameEvent, BotState } from "./types.js";
import { ARENA_WIDTH, ARENA_HEIGHT, MAX_ENERGY } from "./constants.js";
import {
  applyBotCommand,
  createBullet,
  advanceBullets,
  resolveBotCollisions,
} from "./physics.js";
import { computeRadarScans } from "./radar.js";

/**
 * Pure tick function — zero side effects, zero I/O, runs in any JS environment.
 * Takes the current GameState + one BotCommand per bot, returns the next GameState.
 */
export function tick(state: GameState, commands: readonly BotCommand[]): GameState {
  if (state.isOver) return state;

  const cmdMap = new Map<string, BotCommand>(commands.map((c) => [c.botId, c]));
  const events: GameEvent[] = [];

  // Snapshot radar headings before movement (used to compute sweep arc)
  const prevRadarHeadings = new Map<string, number>(
    state.bots.map((b) => [b.id, b.radarHeading]),
  );

  // 1. Movement, rotation, wall collision
  let bots: BotState[] = state.bots.map((bot) => {
    const { next, event } = applyBotCommand(bot, cmdMap.get(bot.id));
    if (event) events.push(event);
    return next;
  });

  // 2. Firing — create new bullets
  let nextBulletId = state.nextBulletId;
  const newBullets: import("./types.js").BulletState[] = [];
  bots = bots.map((bot) => {
    const cmd = cmdMap.get(bot.id);
    if (!cmd?.firePower || bot.gunHeat > 0 || !bot.isAlive) return bot;
    const { bullet, updatedBot } = createBullet(bot, cmd.firePower, `b${nextBulletId++}`);
    newBullets.push(bullet);
    return updatedBot;
  });

  // 3. Advance bullets, detect hits
  const allBullets = [...state.bullets, ...newBullets];
  const { remaining, events: bulletEvents, updatedBots } = advanceBullets(
    allBullets,
    bots,
    ARENA_WIDTH,
    ARENA_HEIGHT,
  );
  bots = updatedBots;
  events.push(...bulletEvents);

  // 4. Bot-bot collisions
  bots = resolveBotCollisions(bots);

  // 5. Mark dead bots
  bots = bots.map((bot) => {
    if (bot.isAlive && bot.energy <= 0) {
      events.push({ type: "botDeath", botId: bot.id });
      return { ...bot, isAlive: false, energy: 0 };
    }
    return bot;
  });

  // 6. Radar scans (after movement so updated positions are used)
  for (const bot of bots) {
    if (!bot.isAlive) continue;
    const prev = prevRadarHeadings.get(bot.id) ?? bot.radarHeading;
    events.push(...computeRadarScans(bot, prev, bots));
  }

  // 7. Win condition
  const alive = bots.filter((b) => b.isAlive);
  const isOver = alive.length <= 1;
  const winnerId = isOver && alive.length === 1 ? (alive[0]?.id ?? null) : null;

  return {
    tick: state.tick + 1,
    bots,
    bullets: remaining,
    events,
    isOver,
    winnerId,
    nextBulletId,
  };
}

export function buildInitialState(
  botDefs: Array<{ id: string; name: string }>,
): GameState {
  const startPositions = [
    { x: 100, y: 100 },
    { x: 700, y: 100 },
    { x: 100, y: 500 },
    { x: 700, y: 500 },
    { x: 400, y: 100 },
    { x: 400, y: 500 },
    { x: 100, y: 300 },
    { x: 700, y: 300 },
  ];

  const bots: BotState[] = botDefs.map((def, i) => ({
    id: def.id,
    name: def.name,
    position: startPositions[i % startPositions.length] ?? { x: 400, y: 300 },
    velocity: 0,
    heading: (i * 90) % 360,
    gunHeading: (i * 90) % 360,
    radarHeading: (i * 90) % 360,
    energy: MAX_ENERGY,
    gunHeat: 3,
    isAlive: true,
  }));

  return {
    tick: 0,
    bots,
    bullets: [],
    events: [],
    isOver: false,
    winnerId: null,
    nextBulletId: 0,
  };
}
