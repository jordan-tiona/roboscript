import type { BotCommand, GameEvent } from "@roboscript/engine";
import type {
  HitByBulletEvent,
  HitWallEvent,
  BulletHitEvent,
} from "@roboscript/engine";
import type { BotStateView, EnemyView } from "./protocol.js";

export type CommandCallback = (cmd: BotCommand) => void;

/**
 * Base class for all user-written bots. Provides the async movement API and
 * event callbacks. Users extend this class and override run() and event methods.
 *
 * The cooperative coroutine model: every await call suspends the bot until
 * the next game tick. The main thread drives the clock; the bot just awaits.
 */
export class RobotRuntime {
  _currentTickId = 0;
  private _botId = "";
  private _botCount = 0;
  private _sendCommand!: CommandCallback;
  private _tickResolve: ((events: readonly GameEvent[]) => void) | null = null;
  private _started = false;

  // Default state — safe to read even before first tick arrives
  private _state: BotStateView = {
    x: 0, y: 0, heading: 0, energy: 100, velocity: 0, gunHeat: 3,
  };

  private _enemies: EnemyView[] = [];

  // ── Readable state properties ──────────────────────────────────────────────
  get x() { return this._state.x; }
  get y() { return this._state.y; }
  get heading() { return this._state.heading; }
  get energy() { return this._state.energy; }
  get velocity() { return this._state.velocity; }
  get gunHeat() { return this._state.gunHeat; }

  /** All non-self bots. Always includes the full roster; check .alive and .visible. */
  get enemies(): readonly EnemyView[] { return this._enemies; }

  /** Number of bots alive in the match right now (including self). */
  get alive(): number {
    return this._enemies.filter((e) => e.alive).length + 1;
  }

  /** Total number of bots that started the match. */
  get botCount(): number { return this._botCount; }

  // ── Internal init (called by botWorker before run()) ───────────────────────
  _init(botId: string, botCount: number, sendCommand: CommandCallback): void {
    this._botId = botId;
    this._botCount = botCount;
    this._sendCommand = sendCommand;
  }

  // ── Called by botWorker on each "tick" message ─────────────────────────────
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

    // Fire event callbacks
    for (const e of events) {
      if (e.type === "hitByBullet") this.onHitByBullet(e);
      else if (e.type === "hitWall") this.onHitWall(e);
      else if (e.type === "bulletHit") this.onBulletHit(e);
      else if (e.type === "botDeath") this.onDeath();
    }

    // Resume the suspended coroutine
    if (this._tickResolve) {
      const resolve = this._tickResolve;
      this._tickResolve = null;
      resolve(events);
    }
  }

  // ── Suspend until next tick, optionally sending a command this tick ────────
  private _nextTick(command?: Omit<BotCommand, "botId">): Promise<readonly GameEvent[]> {
    if (command && this._started) {
      this._sendCommand({ ...command, botId: this._botId });
    }
    return new Promise<readonly GameEvent[]>((resolve) => {
      this._tickResolve = resolve;
    });
  }

  // ── Movement API ───────────────────────────────────────────────────────────

  /** Move forward `distance` units over multiple ticks. */
  async move(distance: number): Promise<void> {
    let remaining = Math.abs(distance);
    const dir = Math.sign(distance) || 1;
    while (remaining > 0.5) {
      const step = Math.min(remaining, 8) * dir;
      remaining -= Math.abs(step);
      await this._nextTick({ desiredVelocity: step });
    }
    await this._nextTick({ desiredVelocity: 0 });
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
   * Turn to face a target position. Rotates the shortest path.
   * Accepts an EnemyView or any object with x/y coordinates.
   */
  async turnToward(target: { x: number; y: number }): Promise<void> {
    const dx = target.x - this._state.x;
    const dy = target.y - this._state.y;
    // Robocode convention: 0=north, CW positive, y-down
    const targetHeading = (Math.atan2(dx, -dy) * 180) / Math.PI;
    let delta = ((targetHeading - this._state.heading + 540) % 360) - 180;
    while (Math.abs(delta) > 0.5) {
      const step = Math.sign(delta) * Math.min(Math.abs(delta), 10);
      await this._nextTick({ turnDegrees: step });
      // Recalculate after each tick since we may have drifted
      const dx2 = target.x - this._state.x;
      const dy2 = target.y - this._state.y;
      const newTarget = (Math.atan2(dx2, -dy2) * 180) / Math.PI;
      delta = ((newTarget - this._state.heading + 540) % 360) - 180;
    }
  }

  /** Fire a bullet. Does nothing if the gun is still cooling down. */
  async fire(): Promise<void> {
    await this._nextTick({ fire: true });
  }

  // ── Event callbacks (override in subclass) ─────────────────────────────────

  onHitByBullet(_e: HitByBulletEvent): void {}
  onHitWall(_e: HitWallEvent): void {}
  onBulletHit(_e: BulletHitEvent): void {}
  onDeath(): void {}

  // ── Entry point (user MUST override) ──────────────────────────────────────
  async run(): Promise<void> {
    throw new Error("Override run() in your bot class");
  }
}
