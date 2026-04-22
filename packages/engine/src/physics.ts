import type {
  BotState,
  BulletState,
  BotCommand,
  HitWallEvent,
  HitByBulletEvent,
  BotCollisionEvent,
  BulletHitEvent,
  BulletMissedEvent,
  Polygon,
} from "./types.js";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  BOT_RADIUS,
  BULLET_RADIUS,
  MAX_SPEED,
  ACCELERATION,
  DECELERATION,
  MAX_TURN_RATE,
  MAX_GUN_TURN_RATE,
  GUN_COOLING_RATE,
  MIN_BULLET_POWER,
  MAX_BULLET_POWER,
  DEFAULT_BULLET_POWER,
  SHIELD_MAX,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_RATE,
  bulletSpeed,
  bulletDamage,
  bulletGunHeat,
} from "./constants.js";
import { headingToVec, clamp, normalizeAngle, distanceSq } from "./util.js";

// ─── Polygon collision helpers ────────────────────────────────────────────────

function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
}

function circleIntersectsPolygon(cx: number, cy: number, r: number, poly: Polygon): boolean {
  if (pointInPolygon(cx, cy, poly)) return true;
  const r2 = r * r;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (distToSegmentSq(cx, cy, poly[j]!.x, poly[j]!.y, poly[i]!.x, poly[i]!.y) < r2) return true;
  }
  return false;
}

function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const d1x = ax2 - ax1, d1y = ay2 - ay1;
  const d2x = bx2 - bx1, d2y = by2 - by1;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-9) return false;
  const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / cross;
  const u = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function bulletPathHitsPolygon(x1: number, y1: number, x2: number, y2: number, poly: Polygon): boolean {
  if (pointInPolygon(x2, y2, poly)) return true;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentsIntersect(x1, y1, x2, y2, poly[j]!.x, poly[j]!.y, poly[i]!.x, poly[i]!.y)) return true;
  }
  return false;
}

// ─── Bot movement & rotation ──────────────────────────────────────────────────

export function applyBotCommand(
  bot: BotState,
  cmd: BotCommand | undefined,
  obstacles: readonly Polygon[],
): { next: BotState; event: HitWallEvent | null } {
  if (!bot.isAlive) return { next: bot, event: null };

  const dBody = clamp(cmd?.turnDegrees    ?? 0, -MAX_TURN_RATE,     MAX_TURN_RATE);
  const dGun  = clamp(cmd?.turnGunDegrees ?? 0, -MAX_GUN_TURN_RATE, MAX_GUN_TURN_RATE);
  const newHeading    = normalizeAngle(bot.heading + dBody);
  const newGunHeading = normalizeAngle(bot.gunHeading + dGun);

  // Velocity with acceleration/deceleration limits
  const desired = clamp(cmd?.desiredVelocity ?? bot.velocity, -MAX_SPEED, MAX_SPEED);
  let vel = bot.velocity;
  if (desired > vel) vel = Math.min(desired, vel + ACCELERATION);
  else if (desired < vel) vel = Math.max(desired, vel - DECELERATION);

  const dir = headingToVec(newHeading);
  let nx = bot.position.x + dir.x * vel;
  let ny = bot.position.y + dir.y * vel;

  let wallEvent: HitWallEvent | null = null;
  const xClamped = clamp(nx, BOT_RADIUS, ARENA_WIDTH - BOT_RADIUS);
  const yClamped = clamp(ny, BOT_RADIUS, ARENA_HEIGHT - BOT_RADIUS);
  if (xClamped !== nx || yClamped !== ny) {
    wallEvent = { type: "hitWall", botId: bot.id, damage: 0 };
    vel = 0;
    nx = xClamped;
    ny = yClamped;
  }

  // Obstacle collision — revert to pre-move position on overlap
  for (const obs of obstacles) {
    if (circleIntersectsPolygon(nx, ny, BOT_RADIUS, obs)) {
      vel = 0;
      nx = bot.position.x;
      ny = bot.position.y;
      break;
    }
  }

  const newGunHeat = Math.max(0, bot.gunHeat - GUN_COOLING_RATE);

  const next: BotState = {
    ...bot,
    position: { x: nx, y: ny },
    velocity: vel,
    heading: newHeading,
    gunHeading: newGunHeading,
    gunHeat: newGunHeat,
    energy: bot.energy,
  };

  return { next, event: wallEvent };
}

// ─── Bullet creation ──────────────────────────────────────────────────────────

export function createBullet(
  bot: BotState,
  bulletId: string,
  power: number = DEFAULT_BULLET_POWER,
): { bullet: BulletState; updatedBot: BotState } {
  const clampedPower = Math.max(MIN_BULLET_POWER, Math.min(MAX_BULLET_POWER, power));
  const bullet: BulletState = {
    id: bulletId,
    ownerId: bot.id,
    position: { ...bot.position },
    heading: bot.gunHeading,
    power: clampedPower,
  };
  const updatedBot: BotState = {
    ...bot,
    gunHeat: bot.gunHeat + bulletGunHeat(clampedPower),
  };
  return { bullet, updatedBot };
}

// ─── Bullet movement + collision ─────────────────────────────────────────────

export function advanceBullets(
  bullets: readonly BulletState[],
  bots: readonly BotState[],
  arenaW: number,
  arenaH: number,
  obstacles: readonly Polygon[],
): {
  remaining: BulletState[];
  events: Array<HitByBulletEvent | BulletHitEvent | BulletMissedEvent>;
  updatedBots: BotState[];
} {
  const events: Array<HitByBulletEvent | BulletHitEvent | BulletMissedEvent> = [];
  const remaining: BulletState[] = [];
  const energyDeltas = new Map<string, number>();
  const shieldDeltas = new Map<string, number>();
  const shieldCooldownReset = new Set<string>();

  for (const bullet of bullets) {
    const dir = headingToVec(bullet.heading);
    const speed = bulletSpeed(bullet.power);
    const nx = bullet.position.x + dir.x * speed;
    const ny = bullet.position.y + dir.y * speed;

    if (nx < 0 || nx > arenaW || ny < 0 || ny > arenaH) {
      events.push({ type: "bulletMissed", bulletId: bullet.id, ownerId: bullet.ownerId });
      continue;
    }

    // Obstacle collision — check bullet's movement path to prevent tunneling
    let hitObstacle = false;
    for (const obs of obstacles) {
      if (bulletPathHitsPolygon(bullet.position.x, bullet.position.y, nx, ny, obs)) {
        hitObstacle = true;
        break;
      }
    }
    if (hitObstacle) {
      events.push({ type: "bulletMissed", bulletId: bullet.id, ownerId: bullet.ownerId });
      continue;
    }

    const movedBullet: BulletState = { ...bullet, position: { x: nx, y: ny } };
    let hit = false;

    for (const bot of bots) {
      if (!bot.isAlive || bot.id === bullet.ownerId) continue;
      const minDist = BOT_RADIUS + BULLET_RADIUS;
      if (distanceSq(movedBullet.position, bot.position) > minDist * minDist) continue;

      hit = true;
      const totalDamage = bulletDamage(bullet.power);
      const shieldAbsorb = Math.min(totalDamage, bot.shield + (shieldDeltas.get(bot.id) ?? 0));
      const energyDamage = totalDamage - shieldAbsorb;

      shieldDeltas.set(bot.id, (shieldDeltas.get(bot.id) ?? 0) - shieldAbsorb);
      energyDeltas.set(bot.id, (energyDeltas.get(bot.id) ?? 0) - energyDamage);
      shieldCooldownReset.add(bot.id);

      events.push({
        type: "hitByBullet",
        victimId: bot.id,
        bulletId: bullet.id,
        ownerId: bullet.ownerId,
        bearing: 0, // caller computes bearing if needed
        damage: totalDamage,
      });
      events.push({
        type: "bulletHit",
        ownerId: bullet.ownerId,
        bulletId: bullet.id,
        victimId: bot.id,
      });
      break; // bullet hits at most one bot
    }

    if (!hit) remaining.push(movedBullet);
  }

  const updatedBots = bots.map((bot) => {
    const energyDelta  = energyDeltas.get(bot.id);
    const shieldDelta  = shieldDeltas.get(bot.id);
    const resetCooldown = shieldCooldownReset.has(bot.id);
    if (energyDelta === undefined && shieldDelta === undefined) return bot;
    return {
      ...bot,
      energy: bot.energy + (energyDelta ?? 0),
      shield: Math.max(0, bot.shield + (shieldDelta ?? 0)),
      shieldCooldown: resetCooldown ? SHIELD_REGEN_DELAY : bot.shieldCooldown,
    };
  });

  return { remaining, events, updatedBots };
}

// ─── Shield regeneration ──────────────────────────────────────────────────────

export function regenShields(bots: readonly BotState[]): BotState[] {
  return bots.map((bot) => {
    if (!bot.isAlive) return bot;
    if (bot.shieldCooldown > 0) {
      return { ...bot, shieldCooldown: bot.shieldCooldown - 1 };
    }
    if (bot.shield < SHIELD_MAX) {
      return { ...bot, shield: Math.min(SHIELD_MAX, bot.shield + SHIELD_REGEN_RATE) };
    }
    return bot;
  });
}

// ─── Bot-bot collision ────────────────────────────────────────────────────────

export function resolveBotCollisions(bots: BotState[]): {
  bots: BotState[];
  events: BotCollisionEvent[];
} {
  const result = [...bots];
  const events: BotCollisionEvent[] = [];

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
      if (!a || !b || !a.isAlive || !b.isAlive) continue;
      const minDist = BOT_RADIUS * 2;
      const dsq = distanceSq(a.position, b.position);
      if (dsq >= minDist * minDist) continue;

      const d = Math.sqrt(dsq) || 1;
      const overlap = minDist - d;
      const ax = (a.position.x - b.position.x) / d;
      const ay = (a.position.y - b.position.y) / d;

      const damageA = Math.abs(a.velocity) * 0.6;
      const damageB = Math.abs(b.velocity) * 0.6;

      result[i] = {
        ...a,
        position: {
          x: clamp(a.position.x + (ax * overlap) / 2, BOT_RADIUS, ARENA_WIDTH - BOT_RADIUS),
          y: clamp(a.position.y + (ay * overlap) / 2, BOT_RADIUS, ARENA_HEIGHT - BOT_RADIUS),
        },
        velocity: 0,
        energy: a.energy - damageB,
      };
      result[j] = {
        ...b,
        position: {
          x: clamp(b.position.x - (ax * overlap) / 2, BOT_RADIUS, ARENA_WIDTH - BOT_RADIUS),
          y: clamp(b.position.y - (ay * overlap) / 2, BOT_RADIUS, ARENA_HEIGHT - BOT_RADIUS),
        },
        velocity: 0,
        energy: b.energy - damageA,
      };

      if (damageB > 0) events.push({ type: "botCollision", botId: a.id, otherId: b.id, damage: damageB });
      if (damageA > 0) events.push({ type: "botCollision", botId: b.id, otherId: a.id, damage: damageA });
    }
  }

  return { bots: result, events };
}
