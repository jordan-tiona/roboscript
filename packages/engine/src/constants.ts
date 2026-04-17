export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

export const BOT_RADIUS = 18;
export const BULLET_RADIUS = 4;

export const MAX_ENERGY = 100;
export const GUN_COOLING_RATE = 0.1;       // heat removed per tick (~10 ticks between shots)
export const MAX_TURN_RATE = 10;           // degrees per tick (body)
export const MAX_GUN_TURN_RATE = 20;       // degrees per tick (gun, independent)
export const MAX_SPEED = 8;               // units per tick
export const ACCELERATION = 1;
export const DECELERATION = 2;

export const TICKS_PER_SECOND = 30;

// ─── Variable bullet power ────────────────────────────────────────────────────
// Higher power = more damage and gun heat, but slower bullet.

export const MIN_BULLET_POWER = 0.1;
export const MAX_BULLET_POWER = 3.0;
export const DEFAULT_BULLET_POWER = 1.0;

export const bulletSpeed   = (p: number): number => 20 - 3 * p;
export const bulletDamage  = (p: number): number => 4 * p;
export const bulletGunHeat = (p: number): number => 1 + p / 5;
