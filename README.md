# RoboScript

A browser-based battle bot arena inspired by [Robocode](https://robocode.sourceforge.io/). Write JavaScript to program tanks that fight each other in a top-down arena.

![Arena screenshot placeholder]

## How it works

You write a bot class in the editor, hit **Start**, and watch it fight a built-in opponent. Bots have a body (movement) and a gun (firing). Every action is async — `await this.move(100)` runs over multiple game ticks, so your bot reads like straightforward sequential code.

```js
class MyRobot extends Robot {
  async run() {
    while (true) {
      await this.turn(15);
      await this.move(100);
      await this.turnGun(360);
      if (this.gunHeat === 0) await this.fire(1.0);
    }
  }

  onHitWall(e) {
    this.turn(45);
  }
}
```

## Bot API

### Movement
| Method | Description |
|---|---|
| `await this.move(distance)` | Move forward (negative = backward) |
| `await this.back(distance)` | Move backward |
| `await this.turn(degrees)` | Rotate body (positive = clockwise) |
| `await this.turnGun(degrees)` | Rotate gun independently of body |

### Combat
| Method | Description |
|---|---|
| `await this.fire(power)` | Fire a bullet (0.1–3.0 power) |
| `this.bulletSpeed(power)` | Returns bullet travel speed for a given power |

### Readable state
```js
this.x          // position
this.y
this.heading    // body direction (degrees, 0 = north, clockwise)
this.gunHeading
this.energy     // 0–100, bot dies at 0
this.velocity
this.gunHeat    // must reach 0 before firing
this.enemies    // array of all other bots with position, heading, energy, etc.
```

### Event callbacks
```js
onHitByBullet(e)   // e.damage, e.bearing, e.ownerId
onBulletHit(e)     // e.victimId
onHitWall(e)       // e.damage
onDeath()
```

## Damage model

- **Bullet damage:** `4 × power`
- **Bullet speed:** `20 - 3 × power` (higher power = slower bullet)
- **Gun heat per shot:** `1 + power / 5`
- High-power shots deal more damage but are slower and lock up your gun longer.

## Project structure

```
roboscript/
├── packages/
│   ├── engine/          # Pure TypeScript simulation — no browser APIs
│   │   └── src/
│   │       ├── types.ts       # GameState, BotState, BotCommand, events
│   │       ├── tick.ts        # tick(state, commands) => state
│   │       ├── physics.ts     # movement, collision, bullets
│   │       └── constants.ts
│   │
│   └── client/          # Vite + React frontend
│       └── src/
│           ├── worker/        # Web Worker sandbox + Robot base class
│           ├── game/          # GameDriver, GameLoop, Canvas renderer
│           └── ui/            # Editor (CodeMirror), Arena, Controls
```

The engine has no DOM dependency — it can run in Node.js unchanged, which is the path to a server-authoritative multiplayer backend.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173, write your bot, hit **Start**.

## Sandbox model

Bot code runs in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) — isolated from the DOM and the main thread. Each bot gets one game tick (≈33ms) to respond with a command. Bots that stall for 30 consecutive ticks are terminated. Infinite loops are harmless — the bot just never acts.

## Roadmap

- [ ] Multiple bot slots (user vs user)
- [ ] Persistent bot storage
- [ ] Ladder / matchmaking
- [ ] Replay viewer
- [ ] Server-side simulation (Node.js + `isolated-vm`)
