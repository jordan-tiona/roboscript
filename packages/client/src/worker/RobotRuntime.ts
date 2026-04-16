import type { BotCommand, GameEvent } from "@roboscript/engine";
import type {
  ScannedRobotEvent,
  HitByBulletEvent,
  HitWallEvent,
  BulletHitEvent,
} from "@roboscript/engine";
import type { BotStateView } from "./protocol.js";

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
  private _sendCommand!: CommandCallback;
  private _tickResolve: ((events: readonly GameEvent[]) => void) | null = null;
  private _started = false;

  // Default state — safe to read even before first tick arrives
  private _state: BotStateView = {
    x: 0, y: 0, heading: 0, gunHeading: 0, radarHeading: 0,
    energy: 100, velocity: 0, gunHeat: 3,
  };

  // ── Readable state properties ──────────────────────────────────────────────
  get x() { return this._state.x; }
  get y() { return this._state.y; }
  get heading() { return this._state.heading; }
  get gunHeading() { return this._state.gunHeading; }
  get radarHeading() { return this._state.radarHeading; }
  get energy() { return this._state.energy; }
  get velocity() { return this._state.velocity; }
  get gunHeat() { return this._state.gunHeat; }

  // ── Internal init (called by botWorker before run()) ───────────────────────
  _init(botId: string, sendCommand: CommandCallback): void {
    this._botId = botId;
    this._sendCommand = sendCommand;
  }

  // ── Called by botWorker on each "tick" message ─────────────────────────────
  _receiveTick(tickId: number, state: BotStateView, events: readonly GameEvent[]): void {
    this._currentTickId = tickId;
    this._state = state;
    this._started = true;

    // Fire event callbacks
    for (const e of events) {
      if (e.type === "scannedRobot") this.onScannedRobot(e);
      else if (e.type === "hitByBullet") this.onHitByBullet(e);
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
    // Only send commands once the game has started (first tick received).
    // This prevents an orphaned command during the init handshake.
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

  /** Rotate the gun by `degrees` relative to body. */
  async turnGun(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 20);
      remaining -= step;
      await this._nextTick({ turnGunDegrees: step });
    }
  }

  /** Rotate the radar by `degrees` relative to gun. */
  async turnRadar(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 45);
      remaining -= step;
      await this._nextTick({ turnRadarDegrees: step });
    }
  }

  /** Fire a bullet with the given power (0.1–3.0). */
  async fire(power: number): Promise<void> {
    await this._nextTick({ firePower: power });
  }

  /** Rotate radar 360° to scan all directions. */
  async scan(): Promise<void> {
    await this.turnRadar(360);
  }

  // ── Event callbacks (override in subclass) ─────────────────────────────────

  onScannedRobot(_e: ScannedRobotEvent): void {}
  onHitByBullet(_e: HitByBulletEvent): void {}
  onHitWall(_e: HitWallEvent): void {}
  onBulletHit(_e: BulletHitEvent): void {}
  onDeath(): void {}

  // ── Entry point (user MUST override) ──────────────────────────────────────
  async run(): Promise<void> {
    throw new Error("Override run() in your bot class");
  }
}
