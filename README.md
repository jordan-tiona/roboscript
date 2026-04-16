# RoboScript

A browser-based battle bot arena inspired by [Robocode](https://robocode.sourceforge.io/). Write JavaScript to program tanks that fight each other in a top-down arena.

![Arena screenshot placeholder]

## How it works

You write a bot class in the editor, hit **Start**, and watch it fight a built-in opponent. Bots have a body (movement), a gun (firing), and a radar (scanning for enemies). Every action is async — `await this.move(100)` runs over multiple game ticks, so your bot reads like straightforward sequential code.

```js
class MyRobot extends Robot {
  async run() {
    while (true) {
      await this.turn(15);
      await this.move(100);
      await this.turnGun(360);
    }
  }

  onScannedRobot(e) {
    this.fire(Math.min(3, e.energy / 10));
  }

  onHitWall() {
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
| `await this.turnGun(degrees)` | Rotate gun relative to body |
| `await this.turnRadar(degrees)` | Rotate radar relative to gun |

### Combat
| Method | Description |
|---|---|
| `await this.fire(power)` | Fire a bullet (0.1–3.0 power) |
| `await this.scan()` | Sweep radar 360° |

### Readable state
```js
this.x          // position
this.y
this.heading    // body direction (degrees, 0 = north, clockwise)
this.gunHeading
this.radarHeading
this.energy     // 0–100, bot dies at 0
this.velocity
this.gunHeat    // must reach 0 before firing
```

### Event callbacks
```js
onScannedRobot(e)  // e.bearing, e.distance, e.energy, e.heading, e.velocity
onHitByBullet(e)   // e.damage, e.bearing, e.ownerId
onBulletHit(e)     // e.victimId, e.energyBonus
onHitWall(e)       // e.damage
onDeath()
```

## Damage model

- **Bullet damage:** `4 × power + (power > 1 ? 2 × (power - 1) : 0)`
- **Shooter energy bonus on hit:** `3 × power`
- **Wall damage:** `0.5 × speed at impact`
- High-power shots do more damage but drain your energy and heat your gun longer.

## Project structure

```
roboscript/
├── packages/
│   ├── engine/          # Pure TypeScript simulation — no browser APIs
│   │   └── src/
│   │       ├── types.ts       # GameState, BotState, BotCommand, events
│   │       ├── tick.ts        # tick(state, commands) => state
│   │       ├── physics.ts     # movement, collision, bullets
│   │       ├── radar.ts       # sweep arc geometry
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
