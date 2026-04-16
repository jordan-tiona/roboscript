// ─── Primitives ───────────────────────────────────────────────────────────────

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

// ─── Entity State ─────────────────────────────────────────────────────────────

export interface BotState {
  readonly id: string;
  readonly name: string;
  readonly position: Vec2;
  readonly velocity: number;      // scalar; direction is always heading
  readonly heading: number;       // degrees, 0 = north, clockwise
  readonly gunHeading: number;    // absolute degrees
  readonly radarHeading: number;  // absolute degrees
  readonly energy: number;
  readonly gunHeat: number;
  readonly isAlive: boolean;
}

export interface BulletState {
  readonly id: string;
  readonly ownerId: string;
  readonly position: Vec2;
  readonly heading: number;
  readonly power: number; // 0.1 – 3.0
}

export interface GameState {
  readonly tick: number;
  readonly bots: readonly BotState[];
  readonly bullets: readonly BulletState[];
  readonly events: readonly GameEvent[];
  readonly isOver: boolean;
  readonly winnerId: string | null;
  readonly nextBulletId: number;
}

// ─── Commands ─────────────────────────────────────────────────────────────────
//
// Struct-of-intent: all fields optional. Engine clamps to max rates.
// Multiple fields may be set in one tick (e.g. turn body while also turning gun).

export interface BotCommand {
  readonly botId: string;
  readonly desiredVelocity?: number;   // units/tick; engine applies accel/decel limits
  readonly turnDegrees?: number;       // body rotation (signed, clamped to MAX_TURN_RATE)
  readonly turnGunDegrees?: number;    // gun rotation relative to body
  readonly turnRadarDegrees?: number;  // radar rotation relative to gun
  readonly firePower?: number;         // 0.1–3.0; ignored if gun heat > 0
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type GameEvent =
  | ScannedRobotEvent
  | HitByBulletEvent
  | HitWallEvent
  | BulletHitEvent
  | BotDeathEvent
  | BulletMissedEvent;

export interface ScannedRobotEvent {
  readonly type: "scannedRobot";
  readonly sourceId: string;
  readonly scannedId: string;
  readonly bearing: number;   // degrees relative to scanning bot's heading
  readonly distance: number;
  readonly energy: number;
  readonly heading: number;
  readonly velocity: number;
}

export interface HitByBulletEvent {
  readonly type: "hitByBullet";
  readonly victimId: string;
  readonly bulletId: string;
  readonly ownerId: string;
  readonly bearing: number;   // degrees relative to victim heading
  readonly damage: number;
}

export interface HitWallEvent {
  readonly type: "hitWall";
  readonly botId: string;
  readonly damage: number;
}

export interface BulletHitEvent {
  readonly type: "bulletHit";
  readonly ownerId: string;
  readonly bulletId: string;
  readonly victimId: string;
  readonly energyBonus: number;
}

export interface BotDeathEvent {
  readonly type: "botDeath";
  readonly botId: string;
}

export interface BulletMissedEvent {
  readonly type: "bulletMissed";
  readonly bulletId: string;
  readonly ownerId: string;
}
