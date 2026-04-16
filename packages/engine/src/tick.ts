import type { GameState, BotCommand, GameEvent, BotState, Vec2 } from "./types.js";
import { ARENA_WIDTH, ARENA_HEIGHT, MAX_ENERGY, BOT_RADIUS } from "./constants.js";
import {
  applyBotCommand,
  createBullet,
  advanceBullets,
  resolveBotCollisions,
} from "./physics.js";
import { computeVisibility } from "./visibility.js";

/**
 * Pure tick function — zero side effects, zero I/O, runs in any JS environment.
 * Takes the current GameState + one BotCommand per bot, returns the next GameState.
 */
export function tick(state: GameState, commands: readonly BotCommand[]): GameState {
  if (state.isOver) return state;

  const cmdMap = new Map<string, BotCommand>(commands.map((c) => [c.botId, c]));
  const events: GameEvent[] = [];

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
    if (!cmd?.fire || bot.gunHeat > 0 || !bot.isAlive) return bot;
    const bulletId = `b${nextBulletId++}`;
    const { bullet, updatedBot } = createBullet(bot, bulletId);
    newBullets.push(bullet);
    events.push({ type: "bulletFired", botId: bot.id, bulletId });
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

  // 6. Compute visibility (after movement so updated positions are used)
  const visibility = computeVisibility(bots);

  // 7. Win condition
  const alive = bots.filter((b) => b.isAlive);
  const isOver = alive.length <= 1;
  const winnerId = isOver && alive.length === 1 ? (alive[0]?.id ?? null) : null;

  return {
    tick: state.tick + 1,
    bots,
    bullets: remaining,
    events,
    visibility,
    isOver,
    winnerId,
    nextBulletId,
  };
}

/**
 * For each bot, pick the random candidate position that maximises the minimum
 * distance to already-placed bots and arena edges. More candidates = better
 * spread at the cost of a tiny bit of startup time.
 */
function generateSpawnPositions(count: number): Vec2[] {
  const margin = BOT_RADIUS + 30;
  const safeW = ARENA_WIDTH  - margin * 2;
  const safeH = ARENA_HEIGHT - margin * 2;
  const CANDIDATES = 64;
  const placed: Vec2[] = [];

  for (let i = 0; i < count; i++) {
    let best: Vec2 = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
    let bestScore = -1;

    for (let c = 0; c < CANDIDATES; c++) {
      const x = margin + Math.random() * safeW;
      const y = margin + Math.random() * safeH;

      // Score: minimum distance to any edge or already-placed bot
      let score = Math.min(x - margin, y - margin, ARENA_WIDTH - margin - x, ARENA_HEIGHT - margin - y);
      for (const p of placed) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (d < score) score = d;
      }

      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    placed.push(best);
  }

  return placed;
}

export function buildInitialState(
  botDefs: Array<{ id: string; name: string }>,
): GameState {
  const positions = generateSpawnPositions(botDefs.length);

  const bots: BotState[] = botDefs.map((def, i) => ({
    id: def.id,
    name: def.name,
    position: positions[i] ?? { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 },
    velocity: 0,
    heading: Math.random() * 360,
    gunHeading: Math.random() * 360,
    energy: MAX_ENERGY,
    gunHeat: 3,
    isAlive: true,
  }));

  return {
    tick: 0,
    bots,
    bullets: [],
    events: [],
    visibility: computeVisibility(bots),
    isOver: false,
    winnerId: null,
    nextBulletId: 0,
  };
}
