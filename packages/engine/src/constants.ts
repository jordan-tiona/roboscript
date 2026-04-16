export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

export const BOT_RADIUS = 18;
export const BULLET_RADIUS = 4;

export const MAX_ENERGY = 100;
export const BULLET_SPEED = 15;

export const GUN_COOLING_RATE = 0.1;
export const MAX_TURN_RATE = 10;       // degrees per tick (body)
export const MAX_GUN_TURN_RATE = 20;   // degrees per tick (gun relative to body)
export const MAX_RADAR_TURN_RATE = 45; // degrees per tick (radar relative to gun)
export const MAX_SPEED = 8;            // units per tick
export const ACCELERATION = 1;
export const DECELERATION = 2;
export const RADAR_WIDTH = 22.5;       // degrees half-arc (total sweep = 45°)

// Damage
export const BULLET_DAMAGE_BASE = 4;       // per unit of fire power
export const BULLET_DAMAGE_BONUS = 2;      // extra per unit above 1.0
export const BULLET_HIT_ENERGY_BONUS = 3;  // energy returned to shooter per unit of power
export const WALL_DAMAGE_FACTOR = 0.5;     // per unit of speed at impact

export const TICKS_PER_SECOND = 30;
