import type { BotCommand, GameEvent } from "@roboscript/engine";
import { bulletSpeed as engineBulletSpeed, DEFAULT_BULLET_POWER } from "@roboscript/engine";
import type {
  HitByBulletEvent,
  HitWallEvent,
  BotCollisionEvent,
  BulletHitEvent,
} from "@roboscript/engine";
import type { BotStateView, EnemyView } from "./protocol.js";

export type CommandCallback = (cmd: BotCommand) => void;

/**
 * Base class for all user-written bots. Provides the async movement API,
 * per-tick event state, and cooperative async event callbacks.
 *
 * ## Coroutine model
 * Every `await` in `run()` suspends the bot until the next game tick.
 *
 * ## Event handling — two styles
 *
 * **Style A — read event state in your main loop (beginner-friendly):**
 * ```js
 * async run() {
 *   while (true) {
 *     if (this.hitWall) await this.turn(90);
 *     await this.move(50);
 *   }
 * }
 * ```
 *
 * **Style B — override async callbacks (runs before run() resumes each tick):**
 * ```js
 * async onHitWall(e) {
 *   await this.turn(90); // await works here
 * }
 * ```
 *
 * Callbacks are *cooperative*: they run at the next natural suspension point
 * in `run()` (i.e. the next tick boundary). While a callback is executing,
 * `run()` waits. New events that arrive during a callback are deferred until
 * the callback finishes.
 */
export class RobotRuntime {
  _currentTickId = 0;
  private _botId = "";
  private _botCount = 0;
  private _sendCommand!: CommandCallback;
  private _tickResolve: ((events: readonly GameEvent[]) => void) | null = null;
  private _started = false;

  // Handler coroutine state
  private _activeHandlerCount = 0;
  private _handlerResolves: Array<(events: readonly GameEvent[]) => void> = [];

  // Default state — safe to read before first tick
  private _state: BotStateView = {
    x: 0, y: 0, heading: 0, gunHeading: 0, energy: 100, velocity: 0, gunHeat: 3,
  };
  private _enemies: EnemyView[] = [];

  // Pending command built up by set* methods, flushed by execute()
  private _pending: {
    desiredVelocity?: number;
    turnDegrees?: number;
    turnGunDegrees?: number;
    fire?: boolean;
    firePower?: number;
  } = {};

  // ── Per-tick event state (Style A) ────────────────────────────────────────
  /** Set if this bot hit a wall this tick; null otherwise. */
  hitWall: HitWallEvent | null = null;
  /** Set if this bot was hit by a bullet this tick; null otherwise. */
  hitByBullet: HitByBulletEvent | null = null;
  /** Set if one of this bot's bullets hit an enemy this tick; null otherwise. */
  bulletHit: BulletHitEvent | null = null;
  /** Set if this bot collided with another bot this tick; null otherwise. */
  botCollision: BotCollisionEvent | null = null;

  // ── Readable state properties ─────────────────────────────────────────────
  get x() { return this._state.x; }
  get y() { return this._state.y; }
  get heading() { return this._state.heading; }
  get gunHeading() { return this._state.gunHeading; }
  get energy() { return this._state.energy; }
  get velocity() { return this._state.velocity; }
  get gunHeat() { return this._state.gunHeat; }

  /** All non-self bots. Always includes the full roster; check .alive and .visible. */
  get enemies(): readonly EnemyView[] { return this._enemies; }

  /** Number of bots alive in the match right now (including self). */
  get alive(): number { return this._enemies.filter((e) => e.alive).length + 1; }

  /** Total number of bots that started the match. */
  get botCount(): number { return this._botCount; }

  // ── Internal init ─────────────────────────────────────────────────────────
  _init(botId: string, botCount: number, sendCommand: CommandCallback, initialState: BotStateView): void {
    this._botId = botId;
    this._botCount = botCount;
    this._sendCommand = sendCommand;
    this._state = initialState;
  }

  // ── Called by botWorker on each tick message ───────────────────────────────
  _receiveTick(
    tickId: number,
    state: BotStateView,
    enemies: EnemyView[],
    events: readonly GameEvent[],
  ): void {
    this._currentTickId = tickId;
    this._state = state;
    this._enemies = enemies;
    this._started = true;

    // Update per-tick event state (Style A) — cleared every tick
    this.hitWall = null;
    this.hitByBullet = null;
    this.bulletHit = null;
    this.botCollision = null;
    for (const e of events) {
      if (e.type === "hitWall") this.hitWall = e;
      else if (e.type === "hitByBullet") this.hitByBullet = e;
      else if (e.type === "bulletHit") this.bulletHit = e;
      else if (e.type === "botCollision") this.botCollision = e;
    }

    // If handlers are mid-execution, give them this tick and hold main
    if (this._handlerResolves.length > 0) {
      const resolves = this._handlerResolves.splice(0);
      for (const r of resolves) r(events);
      return;
    }

    // No active handlers — fire callbacks for this tick's events (Style B)
    if (this._activeHandlerCount === 0) {
      for (const e of events) {
        let result: void | Promise<void>;
        this._activeHandlerCount++;
        if (e.type === "hitByBullet")    result = this.onHitByBullet(e);
        else if (e.type === "hitWall")   result = this.onHitWall(e);
        else if (e.type === "bulletHit") result = this.onBulletHit(e);
        else if (e.type === "botCollision") result = this.onBotCollision(e);
        else if (e.type === "botDeath")   { this._activeHandlerCount--; this.onDeath(); continue; }
        else { this._activeHandlerCount--; continue; }

        if (result instanceof Promise) {
          result.catch(console.error).finally(() => { this._activeHandlerCount--; });
        } else {
          this._activeHandlerCount--;
        }
      }
    }

    // If any handlers started and are now awaiting, hold main for next tick
    if (this._activeHandlerCount > 0 || this._handlerResolves.length > 0) return;

    // No handlers running — resume main coroutine
    if (this._tickResolve) {
      const resolve = this._tickResolve;
      this._tickResolve = null;
      resolve(events);
    }
  }

  // ── Suspend until next tick, optionally sending a command ─────────────────
  private _nextTick(command?: Omit<BotCommand, "botId">): Promise<readonly GameEvent[]> {
    if (command && this._started) {
      this._sendCommand({ ...command, botId: this._botId });
    }
    return new Promise<readonly GameEvent[]>((resolve) => {
      // Route to handler queue if a handler coroutine is active
      if (this._activeHandlerCount > 0) {
        this._handlerResolves.push(resolve);
      } else {
        this._tickResolve = resolve;
      }
    });
  }

  // ── Movement API ──────────────────────────────────────────────────────────

  /**
   * Advance exactly one game tick with any combination of simultaneous actions.
   * Use this when you want to move, turn, and rotate your gun at the same time.
   *
   * The high-level methods (`move`, `turn`, `aimToward` etc.) are built on this
   * and handle the multi-tick looping for you. Use `step()` when you want full
   * control over each tick.
   *
   * @example
   * // Spiral: move and turn simultaneously
   * for (let i = 0; i < 30; i++) {
   *   await this.step({ velocity: 8, turn: 6 });
   * }
   *
   * @example
   * // Chase a target: move toward it while keeping gun aimed
   * while (true) {
   *   const t = this.enemies.find(e => e.visible && e.alive);
   *   if (!t) { await this.step({ turn: 10 }); continue; }
   *   const gunDelta = ...; // angle math
   *   await this.step({ velocity: 8, gunTurn: gunDelta, fire: this.gunHeat === 0 });
   * }
   */
  async step(actions: {
    velocity?: number;
    turn?: number;
    gunTurn?: number;
    fire?: boolean;
    firePower?: number;
  } = {}): Promise<void> {
    await this._nextTick({
      ...(actions.velocity  !== undefined && { desiredVelocity: actions.velocity }),
      ...(actions.turn      !== undefined && { turnDegrees:     actions.turn }),
      ...(actions.gunTurn   !== undefined && { turnGunDegrees:  actions.gunTurn }),
      ...(actions.fire      !== undefined && { fire:            actions.fire }),
      ...(actions.firePower !== undefined && { firePower:       actions.firePower }),
    });
  }

  // ── Utility methods ───────────────────────────────────────────────────────

  /** Distance in units from this bot to any object with x/y coordinates. */
  distanceTo(target: { x: number; y: number }): number {
    return Math.hypot(target.x - this._state.x, target.y - this._state.y);
  }

  /**
   * Absolute heading toward any object with x/y coordinates, in degrees.
   * 0 = north, clockwise positive — consistent with `heading` and `gunHeading`.
   */
  angleTo(target: { x: number; y: number }): number {
    return (Math.atan2(target.x - this._state.x, -(target.y - this._state.y)) * 180) / Math.PI;
  }

  /**
   * Relative bearing from the bot's body heading to the target, in degrees.
   * Negative = target is to the left, positive = to the right. Range: (-180, 180].
   * Use this to know how much to `turn()` to face a target.
   */
  bearingTo(target: { x: number; y: number }): number {
    return ((this.angleTo(target) - this._state.heading + 540) % 360) - 180;
  }

  /**
   * Relative bearing from the gun turret's heading to the target, in degrees.
   * Negative = target is to the left, positive = to the right. Range: (-180, 180].
   * Use this to know how much to `turnGun()` to aim at a target.
   */
  gunBearingTo(target: { x: number; y: number }): number {
    return ((this.angleTo(target) - this._state.gunHeading + 540) % 360) - 180;
  }

  // ── set* / execute() API ─────────────────────────────────────────────────
  //
  // An alternative to step() for users who prefer to build up a command across
  // multiple lines before sending it. All set* calls are order-independent and
  // accumulate into the same pending command. execute() flushes it as one tick.
  //
  // Example:
  //   this.setAhead(8);
  //   this.setTurn(10);
  //   this.setTurnGun(-5);
  //   await this.execute();  // all three happen simultaneously this tick

  /** Queue forward movement at `speed` units/tick (clamped to max speed). */
  setAhead(speed: number): void { this._pending.desiredVelocity =  Math.abs(speed); }

  /** Queue backward movement at `speed` units/tick (clamped to max speed). */
  setBack(speed: number): void  { this._pending.desiredVelocity = -Math.abs(speed); }

  /** Queue a body rotation of `degrees` this tick (positive = clockwise). */
  setTurn(degrees: number): void    { this._pending.turnDegrees    = degrees; }

  /** Queue a gun rotation of `degrees` this tick (positive = clockwise). */
  setTurnGun(degrees: number): void { this._pending.turnGunDegrees = degrees; }

  /** Queue a shot this tick at the given power (defaults to 1.0). Ignored if gun is cooling. */
  setFire(power: number = DEFAULT_BULLET_POWER): void {
    this._pending.fire = true;
    this._pending.firePower = power;
  }

  /**
   * Send all queued set* actions as a single tick command, then wait one tick.
   * The pending queue is cleared after each call.
   */
  async execute(): Promise<void> {
    await this._nextTick({
      ...(this._pending.desiredVelocity !== undefined && { desiredVelocity: this._pending.desiredVelocity }),
      ...(this._pending.turnDegrees     !== undefined && { turnDegrees:     this._pending.turnDegrees }),
      ...(this._pending.turnGunDegrees  !== undefined && { turnGunDegrees:  this._pending.turnGunDegrees }),
      ...(this._pending.fire            !== undefined && { fire:            this._pending.fire }),
      ...(this._pending.firePower       !== undefined && { firePower:       this._pending.firePower }),
    });
    this._pending = {};
  }

  /** Move forward `distance` units over multiple ticks, then stop fully. */
  async move(distance: number): Promise<void> {
    let remaining = Math.abs(distance);
    const dir = Math.sign(distance) || 1;
    while (remaining > 0.5) {
      const step = Math.min(remaining, 8) * dir;
      remaining -= Math.abs(step);
      await this._nextTick({ desiredVelocity: step });
    }
    // Keep braking until fully stopped — deceleration takes several ticks
    while (Math.abs(this._state.velocity) > 0.1) {
      await this._nextTick({ desiredVelocity: 0 });
    }
  }

  /** Move backward `distance` units. */
  async back(distance: number): Promise<void> {
    return this.move(-distance);
  }

  /** Rotate the bot body by `degrees` (positive = clockwise). */
  async turn(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 10);
      remaining -= step;
      await this._nextTick({ turnDegrees: step });
    }
  }

  /**
   * Turn to face a target position, taking the shortest path.
   * Accepts an EnemyView or any object with x/y coordinates.
   */
  async turnToward(target: { x: number; y: number }): Promise<void> {
    const getAngle = () => {
      const dx = target.x - this._state.x;
      const dy = target.y - this._state.y;
      return (Math.atan2(dx, -dy) * 180) / Math.PI;
    };
    let delta = ((getAngle() - this._state.heading + 540) % 360) - 180;
    while (Math.abs(delta) > 0.5) {
      const step = Math.sign(delta) * Math.min(Math.abs(delta), 10);
      await this._nextTick({ turnDegrees: step });
      delta = ((getAngle() - this._state.heading + 540) % 360) - 180;
    }
  }

  /** Rotate the gun by `degrees` (positive = clockwise), independent of body. */
  async turnGun(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 20);
      remaining -= step;
      await this._nextTick({ turnGunDegrees: step });
    }
  }

  /**
   * Aim the gun toward a target position, taking the shortest path.
   * Accepts an EnemyView or any object with x/y coordinates.
   * The body does not rotate — only the turret moves.
   */
  async aimToward(target: { x: number; y: number }): Promise<void> {
    const getAngle = () => {
      const dx = target.x - this._state.x;
      const dy = target.y - this._state.y;
      return (Math.atan2(dx, -dy) * 180) / Math.PI;
    };
    let delta = ((getAngle() - this._state.gunHeading + 540) % 360) - 180;
    while (Math.abs(delta) > 0.5) {
      const step = Math.sign(delta) * Math.min(Math.abs(delta), 20);
      await this._nextTick({ turnGunDegrees: step });
      delta = ((getAngle() - this._state.gunHeading + 540) % 360) - 180;
    }
  }

  /** Fire a bullet at the given power (defaults to 1.0). Does nothing if the gun is cooling. */
  async fire(power: number = DEFAULT_BULLET_POWER): Promise<void> {
    await this._nextTick({ fire: true, firePower: power });
  }

  /**
   * Returns the travel speed (units/tick) of a bullet fired at the given power.
   * Use this when computing intercept angles so you don't hardcode the formula.
   */
  bulletSpeed(power: number = DEFAULT_BULLET_POWER): number {
    return engineBulletSpeed(power);
  }

  // ── Event callbacks — Style B (override and optionally make async) ─────────

  onHitByBullet(_e: HitByBulletEvent): void | Promise<void> {}
  onHitWall(_e: HitWallEvent): void | Promise<void> {}
  onBulletHit(_e: BulletHitEvent): void | Promise<void> {}
  onBotCollision(_e: BotCollisionEvent): void | Promise<void> {}
  onDeath(): void {}

  // ── Entry point ───────────────────────────────────────────────────────────
  async run(): Promise<void> {
    throw new Error("Override run() in your bot class");
  }
}
