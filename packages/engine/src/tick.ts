import type { GameState, BotCommand, GameEvent, BotState, Vec2, Polygon } from "./types.js";
import { ARENA_WIDTH, ARENA_HEIGHT, MAX_ENERGY, BOT_RADIUS, SHIELD_MAX } from "./constants.js";
import {
  applyBotCommand,
  createBullet,
  advanceBullets,
  resolveBotCollisions,
  regenShields,
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
    const { next, event } = applyBotCommand(bot, cmdMap.get(bot.id), state.obstacles);
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
    const { bullet, updatedBot } = createBullet(bot, bulletId, cmd.firePower);
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
    state.obstacles,
  );
  bots = updatedBots;
  events.push(...bulletEvents);

  // 4. Bot-bot collisions
  const { bots: collidedBots, events: collisionEvents } = resolveBotCollisions(bots);
  bots = collidedBots;
  events.push(...collisionEvents);

  // 5. Mark dead bots
  bots = bots.map((bot) => {
    if (bot.isAlive && bot.energy <= 0) {
      events.push({ type: "botDeath", botId: bot.id });
      return { ...bot, isAlive: false, energy: 0 };
    }
    return bot;
  });

  // 5.5 Shield regeneration
  bots = regenShields(bots);

  // 6. Compute visibility (after movement so updated positions are used)
  const visibility = computeVisibility(bots, state.obstacles);

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
    obstacles: state.obstacles,
    isOver,
    winnerId,
    nextBulletId,
  };
}

// ─── Obstacle generation ──────────────────────────────────────────────────────

const OBSTACLE_COUNT        = 2;
const OBSTACLE_CENTER_MARGIN = 150;  // keep centers away from arena edges
const OBSTACLE_MIN_RADIUS   = 50;
const OBSTACLE_MAX_RADIUS   = 90;
const OBSTACLE_MIN_SEPARATION = 280; // min distance between obstacle centers

function generateObstacles(): Polygon[] {
  const obstacles: Polygon[] = [];

  for (let attempt = 0; attempt < 100 && obstacles.length < OBSTACLE_COUNT; attempt++) {
    const cx = OBSTACLE_CENTER_MARGIN + Math.random() * (ARENA_WIDTH  - OBSTACLE_CENTER_MARGIN * 2);
    const cy = OBSTACLE_CENTER_MARGIN + Math.random() * (ARENA_HEIGHT - OBSTACLE_CENTER_MARGIN * 2);

    const tooClose = obstacles.some((obs) => {
      const c = polygonCentroid(obs);
      return Math.hypot(cx - c.x, cy - c.y) < OBSTACLE_MIN_SEPARATION;
    });
    if (tooClose) continue;

    obstacles.push(randomConvexPolygon(cx, cy));
  }

  return obstacles;
}

function polygonCentroid(poly: Polygon): Vec2 {
  return {
    x: poly.reduce((s, v) => s + v.x, 0) / poly.length,
    y: poly.reduce((s, v) => s + v.y, 0) / poly.length,
  };
}

function randomConvexPolygon(cx: number, cy: number): Polygon {
  const n = 4 + Math.floor(Math.random() * 3); // 4–6 vertices
  const baseStep = (Math.PI * 2) / n;
  const angles = Array.from({ length: n }, (_, i) =>
    i * baseStep + (Math.random() - 0.5) * baseStep * 0.6,
  );
  angles.sort((a, b) => a - b);

  return angles.map((angle) => ({
    x: Math.round(cx + (OBSTACLE_MIN_RADIUS + Math.random() * (OBSTACLE_MAX_RADIUS - OBSTACLE_MIN_RADIUS)) * Math.cos(angle)),
    y: Math.round(cy + (OBSTACLE_MIN_RADIUS + Math.random() * (OBSTACLE_MAX_RADIUS - OBSTACLE_MIN_RADIUS)) * Math.sin(angle)),
  }));
}

// ─── Spawn position generation ────────────────────────────────────────────────

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
  const obstacles = generateObstacles();
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
    shield: SHIELD_MAX,
    shieldCooldown: 0,
  }));

  return {
    tick: 0,
    bots,
    bullets: [],
    events: [],
    visibility: computeVisibility(bots, obstacles),
    obstacles,
    isOver: false,
    winnerId: null,
    nextBulletId: 0,
  };
}
