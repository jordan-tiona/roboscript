import type {
  BotState,
  BulletState,
  BotCommand,
  HitWallEvent,
  HitByBulletEvent,
  BotCollisionEvent,
  BulletHitEvent,
  BulletMissedEvent,
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
  bulletSpeed,
  bulletDamage,
  bulletGunHeat,
} from "./constants.js";
import { headingToVec, clamp, normalizeAngle, distanceSq } from "./util.js";

// ─── Bot movement & rotation ──────────────────────────────────────────────────

export function applyBotCommand(
  bot: BotState,
  cmd: BotCommand | undefined,
): { next: BotState; event: HitWallEvent | null } {
  if (!bot.isAlive) return { next: bot, event: null };

  const dBody = clamp(cmd?.turnDegrees ?? 0, -MAX_TURN_RATE, MAX_TURN_RATE);
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
): {
  remaining: BulletState[];
  events: Array<HitByBulletEvent | BulletHitEvent | BulletMissedEvent>;
  updatedBots: BotState[];
} {
  const events: Array<HitByBulletEvent | BulletHitEvent | BulletMissedEvent> = [];
  const remaining: BulletState[] = [];
  const energyDeltas = new Map<string, number>();

  for (const bullet of bullets) {
    const dir = headingToVec(bullet.heading);
    const speed = bulletSpeed(bullet.power);
    const nx = bullet.position.x + dir.x * speed;
    const ny = bullet.position.y + dir.y * speed;

    if (nx < 0 || nx > arenaW || ny < 0 || ny > arenaH) {
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
      const damage = bulletDamage(bullet.power);
      energyDeltas.set(bot.id, (energyDeltas.get(bot.id) ?? 0) - damage);

      events.push({
        type: "hitByBullet",
        victimId: bot.id,
        bulletId: bullet.id,
        ownerId: bullet.ownerId,
        bearing: 0, // caller computes bearing if needed
        damage,
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
    const delta = energyDeltas.get(bot.id);
    if (delta === undefined) return bot;
    return { ...bot, energy: bot.energy + delta };
  });

  return { remaining, events, updatedBots };
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
