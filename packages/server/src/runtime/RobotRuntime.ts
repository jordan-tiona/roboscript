// Server-side copy of the client RobotRuntime.
// BotStateView and EnemyView are defined inline instead of importing from the
// client's worker protocol module.
import type { BotCommand, GameEvent } from "@roboscript/engine";
import {
  bulletSpeed as engineBulletSpeed,
  DEFAULT_BULLET_POWER,
  MAX_SPEED,
  MAX_TURN_RATE,
  MAX_GUN_TURN_RATE,
} from "@roboscript/engine";
import type {
  HitByBulletEvent,
  HitWallEvent,
  HitObstacleEvent,
  BotCollisionEvent,
  BulletHitEvent,
} from "@roboscript/engine";

export interface BotStateView {
  x: number; y: number;
  heading: number; gunHeading: number;
  energy: number; velocity: number;
  gunHeat: number; shield: number;
}

export interface EnemyView {
  id: string; name: string;
  alive: boolean; visible: boolean;
  lastSeen: number | null;
  x: number; y: number;
  heading: number; energy: number; velocity: number;
  firedThisTick: boolean;
}

export type CommandCallback = (cmd: BotCommand) => void;

function pointInPolygon(px: number, py: number, poly: ReadonlyArray<{ x: number; y: number }>): boolean {
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

export class RobotRuntime {
  _currentTickId = 0;
  private _botId = "";
  private _botCount = 0;
  private _arenaWidth = 1200;
  private _arenaHeight = 900;
  private _zoneRadius = 750;
  private _obstacles: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> = [];
  private _sendCommand!: CommandCallback;
  private _tickResolve: ((events: readonly GameEvent[]) => void) | null = null;
  private _started = false;
  private _pendingFirstCommand: Omit<BotCommand, "botId"> | null = null;

  private _activeHandlerCount = 0;
  private _handlerResolves: Array<(events: readonly GameEvent[]) => void> = [];

  private _state: BotStateView = {
    x: 0, y: 0, heading: 0, gunHeading: 0, energy: 100, velocity: 0, gunHeat: 3, shield: 20,
  };
  private _enemies: EnemyView[] = [];

  private _pending: {
    remainingAhead?: number;
    remainingTurn?: number;
    remainingGunTurn?: number;
    fire?: boolean;
    firePower?: number;
  } = {};

  hitWall: HitWallEvent | null = null;
  hitByBullet: HitByBulletEvent | null = null;
  bulletHit: BulletHitEvent | null = null;
  botCollision: BotCollisionEvent | null = null;
  hitObstacle: HitObstacleEvent | null = null;

  get x() { return this._state.x; }
  get y() { return this._state.y; }
  get heading() { return this._state.heading; }
  get headingRadians() { return (this._state.heading * Math.PI) / 180; }
  get gunHeading() { return this._state.gunHeading; }
  get gunHeadingRadians() { return (this._state.gunHeading * Math.PI) / 180; }
  get energy() { return this._state.energy; }
  get velocity() { return this._state.velocity; }
  get gunHeat() { return this._state.gunHeat; }
  get shield() { return this._state.shield; }
  get arenaWidth() { return this._arenaWidth; }
  get arenaHeight() { return this._arenaHeight; }
  get tick() { return this._currentTickId; }
  get zoneRadius() { return this._zoneRadius; }
  get zoneCenter(): { x: number; y: number } { return { x: this._arenaWidth / 2, y: this._arenaHeight / 2 }; }
  get obstacles() { return this._obstacles; }
  get enemies(): readonly EnemyView[] { return this._enemies; }
  get alive(): number { return this._enemies.filter((e) => e.alive).length + 1; }
  get botCount(): number { return this._botCount; }

  _init(
    botId: string,
    botCount: number,
    sendCommand: CommandCallback,
    initialState: BotStateView,
    arenaWidth: number,
    arenaHeight: number,
    obstacles: Array<Array<{ x: number; y: number }>>,
  ): void {
    this._botId = botId;
    this._botCount = botCount;
    this._sendCommand = sendCommand;
    this._state = initialState;
    this._arenaWidth = arenaWidth;
    this._arenaHeight = arenaHeight;
    this._obstacles = obstacles;
  }

  _receiveTick(
    tickId: number,
    state: BotStateView,
    enemies: EnemyView[],
    events: readonly GameEvent[],
    zoneRadius: number,
  ): void {
    this._currentTickId = tickId;
    this._state = state;
    this._enemies = enemies;
    this._zoneRadius = zoneRadius;
    this._started = true;

    if (this._pendingFirstCommand) {
      this._sendCommand({ ...this._pendingFirstCommand, botId: this._botId });
      this._pendingFirstCommand = null;
      return;
    }

    this.hitWall = null;
    this.hitByBullet = null;
    this.bulletHit = null;
    this.botCollision = null;
    this.hitObstacle = null;
    for (const e of events) {
      if (e.type === "hitWall") this.hitWall = e;
      else if (e.type === "hitByBullet") this.hitByBullet = e;
      else if (e.type === "bulletHit") this.bulletHit = e;
      else if (e.type === "botCollision") this.botCollision = e;
      else if (e.type === "hitObstacle") this.hitObstacle = e;
    }

    if (this._handlerResolves.length > 0) {
      const resolves = this._handlerResolves.splice(0);
      for (const r of resolves) r(events);
      return;
    }

    if (this._activeHandlerCount === 0) {
      for (const e of events) {
        let result: void | Promise<void>;
        this._activeHandlerCount++;
        if (e.type === "hitByBullet")    result = this.onHitByBullet(e);
        else if (e.type === "hitWall")      result = this.onHitWall(e);
        else if (e.type === "hitObstacle")  result = this.onHitObstacle(e);
        else if (e.type === "bulletHit")    result = this.onBulletHit(e);
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

    if (this._activeHandlerCount > 0 || this._handlerResolves.length > 0) return;

    if (this._tickResolve) {
      const resolve = this._tickResolve;
      this._tickResolve = null;
      resolve(events);
    }
  }

  private _nextTick(command?: Omit<BotCommand, "botId">): Promise<readonly GameEvent[]> {
    if (command && this._started) {
      this._sendCommand({ ...command, botId: this._botId });
    } else if (command && !this._started) {
      this._pendingFirstCommand = command;
    }
    return new Promise<readonly GameEvent[]>((resolve) => {
      if (this._activeHandlerCount > 0) {
        this._handlerResolves.push(resolve);
      } else {
        this._tickResolve = resolve;
      }
    });
  }

  async step(actions: {
    velocity?: number; turn?: number; gunTurn?: number;
    fire?: boolean; firePower?: number;
  } = {}): Promise<void> {
    await this._nextTick({
      ...(actions.velocity  !== undefined && { desiredVelocity: actions.velocity }),
      ...(actions.turn      !== undefined && { turnDegrees:     actions.turn }),
      ...(actions.gunTurn   !== undefined && { turnGunDegrees:  actions.gunTurn }),
      ...(actions.fire      !== undefined && { fire:            actions.fire }),
      ...(actions.firePower !== undefined && { firePower:       actions.firePower }),
    });
  }

  isOccupied(x: number, y: number): boolean {
    if (x < 0 || x > this._arenaWidth || y < 0 || y > this._arenaHeight) return true;
    for (const poly of this._obstacles) {
      if (pointInPolygon(x, y, poly)) return true;
    }
    return false;
  }

  distanceTo(target: { x: number; y: number }): number {
    return Math.hypot(target.x - this._state.x, target.y - this._state.y);
  }

  angleTo(target: { x: number; y: number }): number {
    return (Math.atan2(target.x - this._state.x, -(target.y - this._state.y)) * 180) / Math.PI;
  }

  angleToRadians(target: { x: number; y: number }): number {
    return Math.atan2(target.x - this._state.x, -(target.y - this._state.y));
  }

  bearingTo(target: { x: number; y: number }): number {
    return ((this.angleTo(target) - this._state.heading + 540) % 360) - 180;
  }

  bearingToRadians(target: { x: number; y: number }): number {
    return (this.bearingTo(target) * Math.PI) / 180;
  }

  gunBearingTo(target: { x: number; y: number }): number {
    return ((this.angleTo(target) - this._state.gunHeading + 540) % 360) - 180;
  }

  gunBearingToRadians(target: { x: number; y: number }): number {
    return (this.gunBearingTo(target) * Math.PI) / 180;
  }

  setAhead(distance: number): void { this._pending.remainingAhead =  Math.abs(distance); }
  setBack(distance: number): void  { this._pending.remainingAhead = -Math.abs(distance); }
  setMove(distance: number): void  { this._pending.remainingAhead = distance; }
  setTurn(degrees: number): void        { this._pending.remainingTurn    =  degrees; }
  setTurnRadians(radians: number): void { this._pending.remainingTurn    =  (radians * 180) / Math.PI; }
  setTurnLeft(degrees: number): void        { this._pending.remainingTurn    = -Math.abs(degrees); }
  setTurnLeftRadians(radians: number): void { this._pending.remainingTurn    = -(Math.abs(radians) * 180) / Math.PI; }
  setTurnRight(degrees: number): void        { this._pending.remainingTurn    =  Math.abs(degrees); }
  setTurnRightRadians(radians: number): void { this._pending.remainingTurn    =  (Math.abs(radians) * 180) / Math.PI; }
  setTurnGun(degrees: number): void        { this._pending.remainingGunTurn =  degrees; }
  setTurnGunRadians(radians: number): void { this._pending.remainingGunTurn =  (radians * 180) / Math.PI; }
  setTurnGunLeft(degrees: number): void        { this._pending.remainingGunTurn = -Math.abs(degrees); }
  setTurnGunLeftRadians(radians: number): void { this._pending.remainingGunTurn = -(Math.abs(radians) * 180) / Math.PI; }
  setTurnGunRight(degrees: number): void        { this._pending.remainingGunTurn =  Math.abs(degrees); }
  setTurnGunRightRadians(radians: number): void { this._pending.remainingGunTurn =  (Math.abs(radians) * 180) / Math.PI; }
  setFire(power: number = DEFAULT_BULLET_POWER): void {
    this._pending.fire = true;
    this._pending.firePower = power;
  }

  get remainingAhead(): number { return this._pending.remainingAhead ?? 0; }
  get remainingTurn(): number  { return this._pending.remainingTurn  ?? 0; }
  get remainingGunTurn(): number { return this._pending.remainingGunTurn ?? 0; }

  async execute(): Promise<void> {
    const cmd: {
      desiredVelocity?: number; turnDegrees?: number; turnGunDegrees?: number;
      fire?: boolean; firePower?: number;
    } = {};

    if (this._pending.remainingAhead !== undefined) {
      const rem = this._pending.remainingAhead;
      const vel = Math.sign(rem) * Math.min(Math.abs(rem), MAX_SPEED);
      cmd.desiredVelocity = vel;
      const next = rem - vel;
      if (Math.abs(next) < 0.5) delete this._pending.remainingAhead;
      else this._pending.remainingAhead = next;
    }

    if (this._pending.remainingTurn !== undefined) {
      const rem = this._pending.remainingTurn;
      const turn = Math.sign(rem) * Math.min(Math.abs(rem), MAX_TURN_RATE);
      cmd.turnDegrees = turn;
      const next = rem - turn;
      if (Math.abs(next) < 0.1) delete this._pending.remainingTurn;
      else this._pending.remainingTurn = next;
    }

    if (this._pending.remainingGunTurn !== undefined) {
      const rem = this._pending.remainingGunTurn;
      const turn = Math.sign(rem) * Math.min(Math.abs(rem), MAX_GUN_TURN_RATE);
      cmd.turnGunDegrees = turn;
      const next = rem - turn;
      if (Math.abs(next) < 0.1) delete this._pending.remainingGunTurn;
      else this._pending.remainingGunTurn = next;
    }

    if (this._pending.fire) {
      cmd.fire = true;
      if (this._pending.firePower !== undefined) cmd.firePower = this._pending.firePower;
      delete this._pending.fire;
      delete this._pending.firePower;
    }

    await this._nextTick(cmd);
  }

  async move(distance: number): Promise<void> {
    let remaining = Math.abs(distance);
    const dir = Math.sign(distance) || 1;
    while (remaining > 0.5) {
      const step = Math.min(remaining, 8) * dir;
      remaining -= Math.abs(step);
      await this._nextTick({ desiredVelocity: step });
    }
    while (Math.abs(this._state.velocity) > 0.1) {
      await this._nextTick({ desiredVelocity: 0 });
    }
  }

  async back(distance: number): Promise<void> { return this.move(-distance); }

  async turn(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 10);
      remaining -= step;
      await this._nextTick({ turnDegrees: step });
    }
  }

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

  async turnGun(degrees: number): Promise<void> {
    let remaining = degrees;
    while (Math.abs(remaining) > 0.1) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 20);
      remaining -= step;
      await this._nextTick({ turnGunDegrees: step });
    }
  }

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

  async fire(power: number = DEFAULT_BULLET_POWER): Promise<void> {
    await this._nextTick({ fire: true, firePower: power });
  }

  bulletSpeed(power: number = DEFAULT_BULLET_POWER): number {
    return engineBulletSpeed(power);
  }

  onHitByBullet(_e: HitByBulletEvent): void | Promise<void> {}
  onHitWall(_e: HitWallEvent): void | Promise<void> {}
  onHitObstacle(_e: HitObstacleEvent): void | Promise<void> {}
  onBulletHit(_e: BulletHitEvent): void | Promise<void> {}
  onBotCollision(_e: BotCollisionEvent): void | Promise<void> {}
  onDeath(): void {}

  async run(): Promise<void> {
    throw new Error("Override run() in your bot class");
  }
}
