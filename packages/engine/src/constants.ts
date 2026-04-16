export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

export const BOT_RADIUS = 18;
export const BULLET_RADIUS = 4;

export const MAX_ENERGY = 100;
export const BULLET_SPEED = 15;
export const BULLET_DAMAGE = 10;
export const BULLET_HIT_ENERGY_BONUS = 5;  // energy restored to shooter on hit

export const GUN_HEAT_PER_SHOT = 1.0;      // heat added per shot
export const GUN_COOLING_RATE = 0.1;       // heat removed per tick (~10 ticks between shots)
export const MAX_TURN_RATE = 10;           // degrees per tick (body)
export const MAX_SPEED = 8;               // units per tick
export const ACCELERATION = 1;
export const DECELERATION = 2;
export const WALL_DAMAGE_FACTOR = 0.5;    // damage per unit of speed at impact

export const VISIBILITY_RANGE = 400;      // units; range-based for MVP (raycasting with terrain later)

export const TICKS_PER_SECOND = 30;
