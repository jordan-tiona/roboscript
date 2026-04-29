import { CompletionContext } from "@codemirror/autocomplete";
import type { CompletionResult, Completion } from "@codemirror/autocomplete";

// ── this.* completions ────────────────────────────────────────────────────────

const THIS_COMPLETIONS: Completion[] = [
  // Readable state
  { label: "x", type: "property", detail: "number", info: "Bot's current X position in the arena." },
  { label: "y", type: "property", detail: "number", info: "Bot's current Y position in the arena." },
  { label: "heading", type: "property", detail: "number", info: "Body heading in degrees (0=north, clockwise)." },
  { label: "headingRadians", type: "property", detail: "number", info: "Body heading in radians." },
  { label: "gunHeading", type: "property", detail: "number", info: "Gun turret heading in degrees (0=north, clockwise)." },
  { label: "gunHeadingRadians", type: "property", detail: "number", info: "Gun turret heading in radians." },
  { label: "energy", type: "property", detail: "number", info: "Remaining energy (0–100). At 0 the bot dies." },
  { label: "velocity", type: "property", detail: "number", info: "Current speed in units/tick (negative = moving backward)." },
  { label: "gunHeat", type: "property", detail: "number", info: "Ticks until the gun can fire again (0 = ready)." },
  { label: "shield", type: "property", detail: "number", info: "Current shield HP (0–20). Absorbs bullet damage before energy." },
  { label: "arenaWidth", type: "property", detail: "number", info: "Total width of the arena in units." },
  { label: "arenaHeight", type: "property", detail: "number", info: "Total height of the arena in units." },
  { label: "tick", type: "property", detail: "number", info: "Current game tick number." },
  { label: "enemies", type: "property", detail: "readonly EnemyView[]", info: "All non-self bots. Check .alive and .visible before using position data." },
  { label: "alive", type: "property", detail: "number", info: "Number of bots still alive, including yourself." },
  { label: "botCount", type: "property", detail: "number", info: "Total bots that started the match." },
  { label: "obstacles", type: "property", detail: "readonly Vec2[][]", info: "Polygon obstacles in the arena. Bullets and LOS are blocked by these." },

  // Per-tick event state
  { label: "hitWall", type: "property", detail: "HitWallEvent | null", info: "Set if your bot hit a wall this tick, null otherwise." },
  { label: "hitByBullet", type: "property", detail: "HitByBulletEvent | null", info: "Set if your bot was hit by a bullet this tick, null otherwise." },
  { label: "bulletHit", type: "property", detail: "BulletHitEvent | null", info: "Set if one of your bullets hit an enemy this tick, null otherwise." },
  { label: "botCollision", type: "property", detail: "BotCollisionEvent | null", info: "Set if your bot collided with another bot this tick, null otherwise." },
  { label: "hitObstacle", type: "property", detail: "HitObstacleEvent | null", info: "Set if your bot hit a terrain obstacle this tick, null otherwise." },

  // remaining* getters
  { label: "remainingAhead", type: "property", detail: "number", info: "Remaining distance from the last setAhead/setBack call." },
  { label: "remainingTurn", type: "property", detail: "number", info: "Remaining rotation from the last setTurn call." },
  { label: "remainingGunTurn", type: "property", detail: "number", info: "Remaining rotation from the last setTurnGun call." },

  // High-level async movement
  {
    label: "move", type: "method", detail: "(distance: number) => Promise<void>",
    apply: "move(${distance})",
    info: "Move forward distance units over multiple ticks, then stop. Use negative distance to go backward.",
  },
  {
    label: "back", type: "method", detail: "(distance: number) => Promise<void>",
    apply: "back(${distance})",
    info: "Move backward distance units (shorthand for move(-distance)).",
  },
  {
    label: "turn", type: "method", detail: "(degrees: number) => Promise<void>",
    apply: "turn(${degrees})",
    info: "Rotate the bot body by degrees (positive = clockwise). Waits until complete.",
  },
  {
    label: "turnToward", type: "method", detail: "(target: {x, y}) => Promise<void>",
    apply: "turnToward(${target})",
    info: "Rotate the body to face a target {x,y} position, taking the shortest path.",
  },
  {
    label: "turnGun", type: "method", detail: "(degrees: number) => Promise<void>",
    apply: "turnGun(${degrees})",
    info: "Rotate the gun turret by degrees (positive = clockwise), independent of body.",
  },
  {
    label: "aimToward", type: "method", detail: "(target: {x, y}) => Promise<void>",
    apply: "aimToward(${target})",
    info: "Aim the gun turret at a target {x,y} position. Body does not move.",
  },
  {
    label: "fire", type: "method", detail: "(power?: number) => Promise<void>",
    apply: "fire(${1})",
    info: "Fire a bullet at the given power (0.1–3, default 1). Higher power = more damage but slower bullet. Does nothing if gun is cooling.",
  },
  {
    label: "step", type: "method", detail: "(actions?) => Promise<void>",
    apply: "step({ velocity: ${8} })",
    info: "Advance exactly one tick with any combination of {velocity, turn, gunTurn, fire, firePower}. Use for fine-grained control.",
  },

  // Utility
  {
    label: "distanceTo", type: "method", detail: "(target: {x, y}) => number",
    apply: "distanceTo(${target})",
    info: "Distance in units from your bot to any object with x/y coordinates.",
  },
  {
    label: "angleTo", type: "method", detail: "(target: {x, y}) => number",
    apply: "angleTo(${target})",
    info: "Absolute heading toward a target in degrees (0=north, clockwise).",
  },
  {
    label: "angleToRadians", type: "method", detail: "(target: {x, y}) => number",
    apply: "angleToRadians(${target})",
    info: "Same as angleTo but returns radians.",
  },
  {
    label: "bearingTo", type: "method", detail: "(target: {x, y}) => number",
    apply: "bearingTo(${target})",
    info: "Relative bearing from your body heading to the target in degrees. Negative = left, positive = right. Range: (-180, 180]. Use to know how much to turn().",
  },
  {
    label: "bearingToRadians", type: "method", detail: "(target: {x, y}) => number",
    apply: "bearingToRadians(${target})",
    info: "Same as bearingTo but returns radians.",
  },
  {
    label: "gunBearingTo", type: "method", detail: "(target: {x, y}) => number",
    apply: "gunBearingTo(${target})",
    info: "Relative bearing from your gun heading to the target in degrees. Use to know how much to turnGun().",
  },
  {
    label: "gunBearingToRadians", type: "method", detail: "(target: {x, y}) => number",
    apply: "gunBearingToRadians(${target})",
    info: "Same as gunBearingTo but returns radians.",
  },
  {
    label: "isOccupied", type: "method", detail: "(x: number, y: number) => boolean",
    apply: "isOccupied(${x}, ${y})",
    info: "Returns true if the point is outside the arena or inside a terrain obstacle. Useful for path planning.",
  },
  {
    label: "bulletSpeed", type: "method", detail: "(power?: number) => number",
    apply: "bulletSpeed(${power})",
    info: "Returns the travel speed of a bullet fired at the given power. Use for intercept calculations.",
  },
  {
    label: "execute", type: "method", detail: "() => Promise<void>",
    apply: "execute()",
    info: "Advance one tick consuming the accumulated set* distances/degrees. Loop while remainingAhead/Turn > 0.",
  },

  // set* API
  { label: "setAhead", type: "method", detail: "(distance: number) => void", apply: "setAhead(${distance})", info: "Queue total forward distance for execute() to consume across ticks." },
  { label: "setBack", type: "method", detail: "(distance: number) => void", apply: "setBack(${distance})", info: "Queue total backward distance for execute() to consume across ticks." },
  { label: "setMove", type: "method", detail: "(distance: number) => void", apply: "setMove(${distance})", info: "Queue distance (positive=forward, negative=backward) for execute()." },
  { label: "setTurn", type: "method", detail: "(degrees: number) => void", apply: "setTurn(${degrees})", info: "Queue total body rotation in degrees for execute() (positive = clockwise)." },
  { label: "setTurnLeft", type: "method", detail: "(degrees: number) => void", apply: "setTurnLeft(${degrees})", info: "Queue a counter-clockwise body rotation." },
  { label: "setTurnRight", type: "method", detail: "(degrees: number) => void", apply: "setTurnRight(${degrees})", info: "Queue a clockwise body rotation." },
  { label: "setTurnRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnRadians(${radians})", info: "Queue total body rotation in radians for execute()." },
  { label: "setTurnLeftRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnLeftRadians(${radians})", info: "Queue a counter-clockwise body rotation in radians." },
  { label: "setTurnRightRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnRightRadians(${radians})", info: "Queue a clockwise body rotation in radians." },
  { label: "setTurnGun", type: "method", detail: "(degrees: number) => void", apply: "setTurnGun(${degrees})", info: "Queue total gun rotation in degrees for execute()." },
  { label: "setTurnGunLeft", type: "method", detail: "(degrees: number) => void", apply: "setTurnGunLeft(${degrees})", info: "Queue a counter-clockwise gun rotation." },
  { label: "setTurnGunRight", type: "method", detail: "(degrees: number) => void", apply: "setTurnGunRight(${degrees})", info: "Queue a clockwise gun rotation." },
  { label: "setTurnGunRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnGunRadians(${radians})", info: "Queue total gun rotation in radians for execute()." },
  { label: "setTurnGunLeftRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnGunLeftRadians(${radians})", info: "Queue a counter-clockwise gun rotation in radians." },
  { label: "setTurnGunRightRadians", type: "method", detail: "(radians: number) => void", apply: "setTurnGunRightRadians(${radians})", info: "Queue a clockwise gun rotation in radians." },
  { label: "setFire", type: "method", detail: "(power?: number) => void", apply: "setFire(${1})", info: "Queue a shot at the given power for the next execute() call." },

  // Event callbacks
  { label: "onHitByBullet", type: "method", detail: "(e: HitByBulletEvent) => void", apply: "onHitByBullet(e) {\n  ${}\n}", info: "Called when your bot is hit by a bullet this tick." },
  { label: "onHitWall", type: "method", detail: "(e: HitWallEvent) => void", apply: "onHitWall(e) {\n  ${}\n}", info: "Called when your bot hits a wall this tick." },
  { label: "onHitObstacle", type: "method", detail: "(e: HitObstacleEvent) => void", apply: "onHitObstacle(e) {\n  ${}\n}", info: "Called when your bot hits a terrain obstacle this tick." },
  { label: "onBulletHit", type: "method", detail: "(e: BulletHitEvent) => void", apply: "onBulletHit(e) {\n  ${}\n}", info: "Called when one of your bullets hits an enemy this tick." },
  { label: "onBotCollision", type: "method", detail: "(e: BotCollisionEvent) => void", apply: "onBotCollision(e) {\n  ${}\n}", info: "Called when your bot collides with another bot this tick." },
  { label: "onDeath", type: "method", detail: "() => void", apply: "onDeath() {\n  ${}\n}", info: "Called when your bot is eliminated." },
  { label: "onBattleEnd", type: "method", detail: "() => void", apply: "onBattleEnd() {\n  ${}\n}", info: "Called for all bots when the battle ends, win or lose. Good place to log final stats." },
];

// ── game.* completions ────────────────────────────────────────────────────────

const GAME_COMPLETIONS: Completion[] = [
  { label: "tick", type: "property", detail: "number", info: "Current game tick number. Available to any class, not just Robot subclasses." },
  { label: "arenaWidth", type: "property", detail: "number", info: "Total width of the arena in units." },
  { label: "arenaHeight", type: "property", detail: "number", info: "Total height of the arena in units." },
  { label: "zoneRadius", type: "property", detail: "number", info: "Current damage zone radius. Bots outside this radius take damage each tick." },
];

// ── Top-level global function completions ─────────────────────────────────────

const GLOBAL_COMPLETIONS: Completion[] = [
  {
    label: "normalRelativeAngle", type: "function",
    detail: "(angle: number) => number",
    apply: "normalRelativeAngle(${angle})",
    info: "Normalizes an angle to the range (-180, 180]. Use to get the shortest signed difference between two headings.",
  },
  {
    label: "normalAbsoluteAngle", type: "function",
    detail: "(angle: number) => number",
    apply: "normalAbsoluteAngle(${angle})",
    info: "Normalizes an angle to the range [0, 360). Use to keep a heading in standard compass form.",
  },
  {
    label: "normalRelativeAngleRadians", type: "function",
    detail: "(angle: number) => number",
    apply: "normalRelativeAngleRadians(${angle})",
    info: "Normalizes a radian angle to the range (-π, π]. Radian equivalent of normalRelativeAngle — use when working with Math.atan2 results.",
  },
];

// ── Math.* completions ────────────────────────────────────────────────────────

const MATH_COMPLETIONS: Completion[] = [
  // Constants
  { label: "PI", type: "constant", detail: "number", info: "π ≈ 3.14159. Ratio of a circle's circumference to its diameter." },
  { label: "E", type: "constant", detail: "number", info: "Euler's number ≈ 2.71828." },
  { label: "SQRT2", type: "constant", detail: "number", info: "√2 ≈ 1.41421." },
  { label: "SQRT1_2", type: "constant", detail: "number", info: "1/√2 ≈ 0.70710." },
  { label: "LN2", type: "constant", detail: "number", info: "Natural log of 2 ≈ 0.69314." },
  { label: "LN10", type: "constant", detail: "number", info: "Natural log of 10 ≈ 2.30258." },
  { label: "LOG2E", type: "constant", detail: "number", info: "Log base 2 of e ≈ 1.44269." },
  { label: "LOG10E", type: "constant", detail: "number", info: "Log base 10 of e ≈ 0.43429." },
  // Common methods
  { label: "abs", type: "method", detail: "(x: number) => number", apply: "abs(${x})", info: "Absolute value of x." },
  { label: "ceil", type: "method", detail: "(x: number) => number", apply: "ceil(${x})", info: "Smallest integer greater than or equal to x." },
  { label: "floor", type: "method", detail: "(x: number) => number", apply: "floor(${x})", info: "Largest integer less than or equal to x." },
  { label: "round", type: "method", detail: "(x: number) => number", apply: "round(${x})", info: "Rounds x to the nearest integer." },
  { label: "trunc", type: "method", detail: "(x: number) => number", apply: "trunc(${x})", info: "Integer part of x, discarding the fraction." },
  { label: "sign", type: "method", detail: "(x: number) => number", apply: "sign(${x})", info: "Returns -1, 0, or 1 depending on the sign of x." },
  { label: "min", type: "method", detail: "(...values: number[]) => number", apply: "min(${a}, ${b})", info: "Returns the smallest of the given values." },
  { label: "max", type: "method", detail: "(...values: number[]) => number", apply: "max(${a}, ${b})", info: "Returns the largest of the given values." },
  { label: "pow", type: "method", detail: "(base: number, exp: number) => number", apply: "pow(${base}, ${exp})", info: "Returns base raised to the power of exp." },
  { label: "sqrt", type: "method", detail: "(x: number) => number", apply: "sqrt(${x})", info: "Square root of x." },
  { label: "cbrt", type: "method", detail: "(x: number) => number", apply: "cbrt(${x})", info: "Cube root of x." },
  { label: "hypot", type: "method", detail: "(...values: number[]) => number", apply: "hypot(${a}, ${b})", info: "Square root of the sum of squares. hypot(a, b) = distance between two points." },
  { label: "random", type: "method", detail: "() => number", apply: "random()", info: "Random float in [0, 1)." },
  // Trig
  { label: "sin", type: "method", detail: "(x: number) => number", apply: "sin(${x})", info: "Sine of x (radians)." },
  { label: "cos", type: "method", detail: "(x: number) => number", apply: "cos(${x})", info: "Cosine of x (radians)." },
  { label: "tan", type: "method", detail: "(x: number) => number", apply: "tan(${x})", info: "Tangent of x (radians)." },
  { label: "asin", type: "method", detail: "(x: number) => number", apply: "asin(${x})", info: "Arcsine of x in radians. Input range [-1, 1]." },
  { label: "acos", type: "method", detail: "(x: number) => number", apply: "acos(${x})", info: "Arccosine of x in radians. Input range [-1, 1]." },
  { label: "atan", type: "method", detail: "(x: number) => number", apply: "atan(${x})", info: "Arctangent of x in radians." },
  { label: "atan2", type: "method", detail: "(y: number, x: number) => number", apply: "atan2(${y}, ${x})", info: "Angle in radians between the positive x-axis and the point (x, y). Range: (-π, π]." },
  // Log / exp
  { label: "log", type: "method", detail: "(x: number) => number", apply: "log(${x})", info: "Natural logarithm (base e) of x." },
  { label: "log2", type: "method", detail: "(x: number) => number", apply: "log2(${x})", info: "Base-2 logarithm of x." },
  { label: "log10", type: "method", detail: "(x: number) => number", apply: "log10(${x})", info: "Base-10 logarithm of x." },
  { label: "exp", type: "method", detail: "(x: number) => number", apply: "exp(${x})", info: "e raised to the power of x." },
];

// ── EnemyView property completions ────────────────────────────────────────────

const ENEMY_COMPLETIONS: Completion[] = [
  { label: "id", type: "property", detail: "string", info: "Unique bot ID." },
  { label: "name", type: "property", detail: "string", info: "Bot's display name." },
  { label: "alive", type: "property", detail: "boolean", info: "True if this enemy is still alive in the match." },
  { label: "visible", type: "property", detail: "boolean", info: "True if this enemy is currently in line-of-sight." },
  { label: "lastSeen", type: "property", detail: "number | null", info: "Ticks since this enemy was last seen. null = never observed." },
  { label: "x", type: "property", detail: "number", info: "Last known X position. May be stale if visible=false." },
  { label: "y", type: "property", detail: "number", info: "Last known Y position. May be stale if visible=false." },
  { label: "heading", type: "property", detail: "number", info: "Last known heading in degrees." },
  { label: "energy", type: "property", detail: "number", info: "Last known energy level." },
  { label: "velocity", type: "property", detail: "number", info: "Last known velocity in units/tick." },
  { label: "firedThisTick", type: "property", detail: "boolean", info: "True only when visible and this enemy fired this tick." },
];

// ── Completion source ─────────────────────────────────────────────────────────

export function robotCompletionSource(context: CompletionContext): CompletionResult | null {
  // Match "this.<partial>"
  const thisMatch = context.matchBefore(/this\.\w*/);
  if (thisMatch) {
    const dot = thisMatch.text.indexOf(".");
    const from = thisMatch.from + dot + 1;
    return { from, options: THIS_COMPLETIONS, validFor: /^\w*$/ };
  }

  // Match bare global function names (not preceded by a dot)
  const globalWord = context.matchBefore(/\b\w+/);
  if (globalWord && context.state.doc.sliceString(globalWord.from - 1, globalWord.from) !== ".") {
    return { from: globalWord.from, options: GLOBAL_COMPLETIONS, validFor: /^\w*$/ };
  }

  // Match "Math.<partial>"
  const mathMatch = context.matchBefore(/\bMath\.\w*/);
  if (mathMatch) {
    const dot = mathMatch.text.indexOf(".");
    const from = mathMatch.from + dot + 1;
    return { from, options: MATH_COMPLETIONS, validFor: /^\w*$/ };
  }

  // Match "game.<partial>"
  const gameMatch = context.matchBefore(/\bgame\.\w*/);
  if (gameMatch) {
    const dot = gameMatch.text.indexOf(".");
    const from = gameMatch.from + dot + 1;
    return { from, options: GAME_COMPLETIONS, validFor: /^\w*$/ };
  }

  // Match "<identifier>.<partial>" for likely EnemyView accesses
  // Heuristic: variable names that suggest an enemy (e, enemy, target, bot, etc.)
  const enemyMatch = context.matchBefore(/\b(?:e|enemy|target|bot|foe|opp|opponent|other)\.\w*/);
  if (enemyMatch) {
    const dot = enemyMatch.text.indexOf(".");
    const from = enemyMatch.from + dot + 1;
    return { from, options: ENEMY_COMPLETIONS, validFor: /^\w*$/ };
  }

  return null;
}
