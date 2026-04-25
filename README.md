# RoboScript

A browser-based battle bot arena inspired by [Robocode](https://robocode.sourceforge.io/). Write JavaScript to program tanks that fight each other in a top-down 2D arena.

## How it works

You write a bot class in the in-browser editor, hit **Start**, and watch it fight. Every action is async — `await this.move(100)` runs over multiple game ticks, so bot code reads like normal sequential JavaScript.

```js
class MyRobot extends Robot {
  async run() {
    while (true) {
      await this.turnGun(360);
      const target = this.enemies.find(e => e.visible && e.alive);
      if (target) {
        await this.aimToward(target);
        if (this.gunHeat === 0) await this.fire(2);
      }
      await this.turn(30);
      await this.move(80);
    }
  }

  onHitWall() {
    this.turn(90);
  }
}
```

## Features

- **Tutorial** — 7 progressive challenges that introduce movement, aiming, firing, and event handling
- **Free play** — fight any combination of 8 built-in example bots with optional terrain obstacles
- **Accounts** — register and save your bots to the server; pick up where you left off from any device
- **CodeMirror editor** — syntax highlighting, Tab indentation, and robot API autocomplete (`this.`, `e.`)
- **Shield system** — bots have a regenerating shield that absorbs bullet damage before energy
- **Shrinking zone** — after 30 seconds, a kill zone begins closing in; bots outside it drain energy

## Bot API

### High-level movement (async — awaited over multiple ticks)

| Method | Description |
|---|---|
| `await this.move(distance)` | Move forward; negative = backward |
| `await this.back(distance)` | Move backward |
| `await this.turn(degrees)` | Rotate body (positive = clockwise) |
| `await this.turnToward(target)` | Turn body to face a `{x, y}` target |
| `await this.turnGun(degrees)` | Rotate gun independently of body |
| `await this.aimToward(target)` | Aim gun at a `{x, y}` target |
| `await this.fire(power)` | Fire a bullet (0.1–3.0); no-op if gun is cooling |
| `await this.step(actions)` | One raw tick: `{velocity, turn, gunTurn, fire, firePower}` |

### set* / execute() API (accumulate then drain)

```js
this.setAhead(200);
this.setTurn(90);
while (this.remainingAhead > 0 || this.remainingTurn > 0) {
  await this.execute(); // moves and turns simultaneously
}
```

| Method | Description |
|---|---|
| `setAhead(d)` / `setBack(d)` / `setMove(d)` | Queue forward/backward distance |
| `setTurn(deg)` / `setTurnLeft(deg)` / `setTurnRight(deg)` | Queue body rotation |
| `setTurnGun(deg)` / `setTurnGunLeft(deg)` / `setTurnGunRight(deg)` | Queue gun rotation |
| `setFire(power)` | Queue a shot for the next `execute()` |
| `await this.execute()` | Consume one tick's worth of queued actions |
| `this.remainingAhead` / `remainingTurn` / `remainingGunTurn` | Check remaining distances |

### Readable state

```js
this.x / this.y           // position
this.heading              // body direction (degrees, 0 = north, clockwise)
this.gunHeading
this.energy               // 0–100; bot dies at 0
this.velocity             // current speed (negative = moving backward)
this.gunHeat              // must reach 0 before firing again
this.shield               // 0–20; absorbs bullet damage before energy
this.tick                 // current game tick
this.arenaWidth / this.arenaHeight
this.zoneRadius           // current kill zone radius (shrinks after tick 900)
this.zoneCenter           // {x, y} — always the arena center
this.alive                // number of bots still alive (including self)
this.botCount             // total bots that started the match
this.enemies              // EnemyView[] — all non-self bots
this.obstacles            // Vec2[][] — terrain polygons (bullets and LOS blocked)
```

### EnemyView fields

```js
e.id / e.name
e.alive                   // false if eliminated
e.visible                 // true if currently in line-of-sight
e.lastSeen                // ticks since last seen (null = never observed)
e.x / e.y / e.heading / e.energy / e.velocity  // last known values
e.firedThisTick           // true only when visible and fired this tick
```

### Utility methods

```js
this.distanceTo(target)         // units to any {x, y}
this.angleTo(target)            // absolute heading toward target (degrees)
this.bearingTo(target)          // relative to body heading (-180…180); use with turn()
this.gunBearingTo(target)       // relative to gun heading (-180…180); use with turnGun()
this.bulletSpeed(power)         // travel speed for a given bullet power
this.isOccupied(x, y)           // true if point is outside arena or inside an obstacle
```

### Event callbacks (Style B — override and optionally make async)

```js
onHitByBullet(e)   // e.damage, e.bearing, e.ownerId
onBulletHit(e)     // e.victimId
onHitWall(e)       // e.damage
onHitObstacle(e)
onBotCollision(e)  // e.otherId, e.damage
onDeath()
```

> **Note:** Only declare a callback `async` if you actually `await` something inside it. Declaring it async without awaiting causes a tick skip.

### Per-tick event state (Style A — read in your main loop)

```js
this.hitWall        // HitWallEvent | null
this.hitByBullet    // HitByBulletEvent | null
this.bulletHit      // BulletHitEvent | null
this.botCollision   // BotCollisionEvent | null
this.hitObstacle    // HitObstacleEvent | null
```

## Damage & mechanics

| Mechanic | Formula |
|---|---|
| Bullet damage | `8 × power` |
| Bullet speed | `26 - 3 × power` (higher power = slower) |
| Gun heat per shot | `1 + power / 5` |
| Shield max | 20 HP |
| Shield regen delay | 150 ticks after last hit |
| Zone damage | 0.5 energy/tick while outside the zone |
| Zone starts shrinking | tick 900 (30s) |
| Zone fully closed / match ends | tick 1800 (60s) |

At tick 1800, if multiple bots are alive, the highest-energy bot wins. Equal energy is a draw.

## Project structure

```
roboscript/
├── packages/
│   ├── engine/          # Pure TypeScript simulation — no browser or Node APIs
│   │   └── src/
│   │       ├── types.ts       # GameState, BotState, BotCommand, all event types
│   │       ├── tick.ts        # tick(state, commands) => state; buildInitialState()
│   │       ├── physics.ts     # movement, wall/obstacle/bot collision, bullets, shields
│   │       ├── visibility.ts  # LOS computation (obstacles block vision)
│   │       └── constants.ts   # speeds, damage, zone timing, shield values
│   │
│   ├── client/          # Vite + React frontend
│   │   └── src/
│   │       ├── worker/        # Web Worker sandbox (botWorker) + RobotRuntime base class
│   │       ├── game/          # GameDriver (tick loop), GameLoop (rAF), renderer (canvas)
│   │       ├── ui/            # Editor (CodeMirror + robot autocomplete), Arena, Controls,
│   │       │                  # BattleConfig, SavesPanel, DocsPanel, ChallengeIntro
│   │       ├── pages/         # SplashPage (login/register), DashboardPage
│   │       ├── tutorial/      # 7 challenge definitions + opponent bots
│   │       ├── bots/          # Built-in example bot code (Dummy, Turret, Predictor, …)
│   │       └── api/           # fetch wrappers for auth, profile, bots endpoints
│   │
│   └── server/          # Hono API server
│       └── src/
│           ├── index.ts       # Server entry, route mounting
│           ├── auth.ts        # better-auth configuration
│           ├── db/
│           │   ├── schema.ts  # Drizzle schema: users, sessions, bot_saves,
│           │   │              # tutorial_progress, ladder_entries, ladder_matches
│           │   └── index.ts   # Drizzle client (postgres)
│           └── routes/
│               ├── bots.ts    # CRUD for saved bots
│               └── profile.ts # Tutorial progress
```

## Getting started

```bash
pnpm install

# Terminal 1 — API server (requires PostgreSQL)
pnpm --filter @roboscript/server dev

# Terminal 2 — frontend
pnpm --filter @roboscript/client dev
```

Copy `.env.example` to `.env` in `packages/server` and fill in `DATABASE_URL` and `BETTER_AUTH_SECRET`.

Open http://localhost:5173, create an account, and complete the tutorial or jump straight to free play.

## Sandbox model

Bot code runs in a Web Worker, isolated from the DOM and main thread. The engine gives each bot up to 50ms per tick to respond with a command. Bots that stall for 30 consecutive ticks are terminated. `Math.random()` works normally in bot code (results are not reproducible — replays store full state snapshots rather than re-executing code).

## Roadmap

- [ ] Ladder / ranked matchmaking with Elo ratings
- [ ] Async server-side match runner
- [ ] Replay viewer (keyframe-compressed state snapshots)
- [ ] Premium tier (more daily matches, persistent replays, multiple active bots)
- [ ] Private leagues
