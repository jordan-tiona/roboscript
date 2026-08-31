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
- **CodeMirror editor** — syntax highlighting, Tab indentation, and robot API autocomplete (`this.`, `e.`, `game.`, `Math.`, global utility functions)
- **Shield system** — bots have a regenerating shield that absorbs bullet damage before energy
- **Shrinking zone** — after 30 seconds, a kill zone begins closing in; bots outside it drain energy
- **Speed control** — slow battles down to 1/16× speed from the toolbar for debugging

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

### Global sandbox objects and functions

These are available to any class in your bot file, not just Robot subclasses:

```js
// game — live match state, readable from helper classes
game.tick          // current game tick
game.arenaWidth    // arena width in units
game.arenaHeight   // arena height in units
game.zoneRadius    // current kill zone radius

// Angle utilities (degrees)
normalRelativeAngle(angle)    // normalize to (-180, 180]
normalAbsoluteAngle(angle)    // normalize to [0, 360)

// Angle utility (radians) — use with Math.atan2 results
normalRelativeAngleRadians(angle)  // normalize to (-π, π]
```

### Event callbacks (Style B — override and optionally make async)

```js
onHitByBullet(e)   // e.damage, e.bearing, e.ownerId
onBulletHit(e)     // e.victimId
onHitWall(e)       // e.damage
onHitObstacle(e)
onBotCollision(e)  // e.otherId, e.damage
onDeath()          // called when your bot is eliminated
onBattleEnd()      // called for all bots when the match ends (win or lose)
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

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 24 | `packageManager` pins pnpm, so enable Corepack: `corepack enable` |
| pnpm | >= 10 | `corepack enable pnpm` gets the pinned version automatically |
| Docker | any recent | Only used to run PostgreSQL via `docker-compose.yml` |

### First run

```bash
git clone git@github.com:jordan-tiona/roboscript.git
cd roboscript
corepack enable
pnpm install

# Start PostgreSQL (postgres:16-alpine, exposed on localhost:5432)
pnpm db:up

# Create the server env file, then fill in the blanks (see below)
cp packages/server/.env.example packages/server/.env

# Apply the Drizzle schema to the fresh database
pnpm --filter @roboscript/server db:migrate

# Run client + server together
pnpm dev:all
```

Open http://localhost:5173, create an account, and complete the tutorial or jump straight to free play.

To run the two halves in separate terminals instead: `pnpm dev:server` and `pnpm dev`.

### Environment variables

`packages/server/.env` is gitignored and must be created on each machine. Minimum for local dev:

```
DATABASE_URL=postgres://roboscript:roboscript@localhost:5432/roboscript
BETTER_AUTH_SECRET=<any random string; openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:8080/api/auth
CLIENT_ORIGIN=http://localhost:5173
PORT=8080
```

`DATABASE_URL` above matches the credentials baked into `docker-compose.yml`. `SMTP_*` may be left blank
(password-reset emails will fail, nothing else). `RS_RECAPTCHA_SECRET_KEY` may be left blank — verification
is skipped when it is unset.

## Developing on Windows

The project runs natively on Windows (PowerShell), no WSL required. All npm scripts are cross-platform and
nothing in the codebase shells out or hardcodes POSIX paths.

### One-time setup

1. **Install Node 24+** — [nodejs.org](https://nodejs.org) or `winget install OpenJS.NodeJS.LTS`.
2. **Enable Corepack** in an *elevated* PowerShell so it can create shims:
   ```powershell
   corepack enable
   ```
   The `packageManager` field in the root `package.json` pins the pnpm version, so nothing else is needed.
3. **Install Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop/), with the
   WSL2 backend (its default). This is only used for the PostgreSQL container.
4. **Enable long paths.** pnpm's nested `node_modules` layout plus deep package names can exceed the legacy
   260-character limit:
   ```powershell
   git config --system core.longpaths true
   # and, elevated:
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
     -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```
5. **Enable Developer Mode** (Settings → System → For developers). pnpm links workspace packages with
   symlinks/junctions; Developer Mode lets it create them without administrator rights.

### Running it

```powershell
git clone git@github.com:jordan-tiona/roboscript.git
cd roboscript
pnpm install

pnpm db:up                                  # starts PostgreSQL in Docker
Copy-Item packages\server\.env.example packages\server\.env
# edit packages\server\.env — see "Environment variables" above

pnpm --filter @roboscript/server db:migrate
pnpm dev:all
```

### Windows-specific notes

- **Line endings.** `.gitattributes` forces `eol=lf` for the whole tree. Do not override it with
  `core.autocrlf=true` — bot source under `packages/client/src/bots/code/` is imported with Vite's `?raw`
  and rendered verbatim in the CodeMirror editor, so CRLF would end up inside saved bot code.
- **Case sensitivity.** NTFS is case-insensitive but Linux CI and the Fly deploy image are not. An import
  like `./RobotRuntime.js` written as `./robotruntime.js` will work locally and fail in the container —
  match the file's real casing.
- **Secrets don't come from git.** `packages/server/.env` is gitignored; copy the values across manually
  (SMTP password and the reCAPTCHA secret in particular).
- **Ports.** 5173 (Vite) and 8080 (Hono) must be free; Windows' "excluded port ranges" reserved by
  Hyper-V occasionally claim 8080. Check with `netsh interface ipv4 show excludedportrange protocol=tcp`
  and set `PORT` in `.env` if it collides.
- **File watching.** `vite` and `tsx watch` use native filesystem events on NTFS — no polling flags needed.
  This only breaks if the repo lives on a network drive or inside a WSL filesystem accessed from Windows.

## Sandbox model

Bot code runs in a sandboxed environment in both the browser and on the server:

- **Browser**: Web Worker, isolated from the DOM and main thread. Up to 33ms per tick.
- **Server** (ladder matches): Node.js `worker_threads` with `vm.createContext` — no access to `require`, `process`, `fs`, or any Node.js built-in. Up to 33ms per tick.

Bots that stall for 30 consecutive ticks are terminated. The sandbox behaviour is intentionally equivalent between browser and server so bots behave the same whether you're testing locally or running a ranked match.

`Math.random()` works normally in bot code (results are not reproducible — replays store full state snapshots rather than re-executing code).

## Roadmap

- [ ] Ladder / ranked matchmaking with Elo ratings
- [ ] Async server-side match runner
- [ ] Replay viewer (keyframe-compressed state snapshots)
- [ ] Premium tier (more daily matches, persistent replays, multiple active bots)
- [ ] Private leagues
