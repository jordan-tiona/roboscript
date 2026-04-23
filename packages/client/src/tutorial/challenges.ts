import type { BotEntry } from "../game/GameDriver.js";

import dummyCode       from "../bots/code/tutorial/dummy.js?raw";
import turretCode      from "../bots/code/tutorial/turret.js?raw";
import predictorCode   from "../bots/code/tutorial/predictor.js?raw";
import wandererCode    from "../bots/code/tutorial/wanderer.js?raw";
import duelistCode     from "../bots/code/tutorial/duelist.js?raw";
import sprinterCode    from "../bots/code/tutorial/sprinter.js?raw";
import sniperCode      from "../bots/code/tutorial/sniper.js?raw";

import d1Code from "../bots/code/tutorial/demo/d1_mover.js?raw";
import d2Code from "../bots/code/tutorial/demo/d2_circler.js?raw";
import d3Code from "../bots/code/tutorial/demo/d3_random.js?raw";
import d5Code from "../bots/code/tutorial/demo/d5_stepper.js?raw";
import d6Code from "../bots/code/tutorial/demo/d6_survivor.js?raw";
import d7Code from "../bots/code/tutorial/demo/d7_predictor.js?raw";
import d8Code from "../bots/code/tutorial/demo/d8_cover.js?raw";

export interface Challenge {
  index: number;
  title: string;
  blurb: string;
  snippet: string;     // illustrative code shown in the intro card
  opponent: BotEntry;
  extraOpponents?: BotEntry[];
  demo: { player: BotEntry; opponent: BotEntry; extraOpponents?: BotEntry[] };
  withObstacles?: boolean;
}

export const DEMO_ARENA = { arenaWidth: 600, arenaHeight: 450, obstacles: false } as const;
export const DEMO_ARENA_OBS = { arenaWidth: 600, arenaHeight: 450, obstacles: true } as const;

export const CHALLENGES: Challenge[] = [
  {
    index: 0,
    title: "Get moving",
    blurb: "Your bot does nothing by default — it needs you to write a run() loop. " +
      "Start by moving forward, turning, and firing at whatever is in front of you. " +
      "The Dummy fires randomly and won't dodge, so any consistent offense will win.",
    snippet:
`async run() {
  while (true) {
    const target = this.enemies.find(e => e.alive);
    if (target) await this.aimToward(target);
    if (this.gunHeat === 0) await this.fire(1);
    await this.move(60);
    await this.turn(90);
  }
}`,
    opponent: { id: "opp-0", name: "Dummy", code: dummyCode },
    demo: {
      player:   { id: "demo-p", name: "You", code: d1Code },
      opponent: { id: "demo-o", name: "Dummy", code: dummyCode },
    },
  },
  {
    index: 1,
    title: "Keep your distance",
    blurb: "The Turret never moves, but it tracks you precisely and fires fast. " +
      "Standing still for even a second is enough to get destroyed. " +
      "You need to keep moving constantly — try orbiting it.",
    snippet:
`async run() {
  while (true) {
    // keep turning while firing — never stop
    const target = this.enemies.find(e => e.alive);
    await this.step({
      velocity: 7,
      turn: 8,
      gunTurn: target ? this.gunBearingTo(target) : 10,
      fire: this.gunHeat === 0,
    });
  }
}`,
    opponent: { id: "opp-1", name: "Turret", code: turretCode },
    demo: {
      player:   { id: "demo-p", name: "You", code: d2Code },
      opponent: { id: "demo-o", name: "Turret", code: turretCode },
    },
  },
  {
    index: 2,
    title: "Move unpredictably",
    blurb: "The Predictor is stationary but uses linear shot prediction — " +
      "if you move at a constant speed in a straight line, its bullets will hit you. " +
      "Randomizing your movement distance and turn angle makes you nearly impossible to hit.",
    snippet:
`async run() {
  while (true) {
    // vary distance and angle so your path is unpredictable
    await this.move(30 + Math.random() * 80);
    await this.turn((Math.random() - 0.5) * 160);
    const target = this.enemies.find(e => e.visible && e.alive);
    if (target) {
      await this.aimToward(target);
      if (this.gunHeat === 0) await this.fire(1.5);
    }
  }
}`,
    opponent: { id: "opp-2", name: "Predictor", code: predictorCode },
    demo: {
      player:   { id: "demo-p", name: "You", code: d3Code },
      opponent: { id: "demo-o", name: "Predictor", code: predictorCode },
    },
  },
  {
    index: 3,
    title: "Do two things at once",
    blurb: "The Duelist charges you — if you stop moving to aim, it closes the gap and rams you. " +
      "step() lets you turn, move, and fire all in the same tick. " +
      "Try circling it: turn toward it offset by ~60°, aim the gun independently.",
    snippet:
`async run() {
  while (true) {
    const target = this.enemies.find(e => e.alive);
    if (!target) { await this.step({ velocity: 6, turn: 10 }); continue; }

    await this.step({
      velocity: 6,
      turn: this.bearingTo(target) + 60, // orbit, not chase
      gunTurn: this.gunBearingTo(target), // gun tracks independently
      fire: this.gunHeat === 0,
      firePower: 1.5,
    });
  }
}`,
    opponent: { id: "opp-3", name: "Duelist", code: duelistCode },
    demo: {
      player:   { id: "demo-p", name: "You", code: d5Code },
      opponent: { id: "demo-o", name: "Duelist", code: duelistCode },
    },
  },
  {
    index: 4,
    title: "Survive the pressure",
    blurb: "Two opponents at once: the Turret fires from a fixed position while the Wanderer " +
      "approaches from an unpredictable angle. There's no single target to focus on — " +
      "you need to stay mobile, prioritize the closer threat, and keep your shield from depleting.",
    snippet:
`async run() {
  while (true) {
    const alive = this.enemies.filter(e => e.alive);
    // target the nearest threat
    const target = alive.sort((a, b) =>
      this.distanceTo(a) - this.distanceTo(b)
    )[0];
    if (!target) { await this.step({ velocity: 6, turn: 8 }); continue; }

    await this.step({
      velocity: 7,
      turn: this.bearingTo(target) + 50,
      gunTurn: this.gunBearingTo(target),
      fire: this.gunHeat === 0,
      firePower: 1.5,
    });
  }
}`,
    opponent:       { id: "opp-4a", name: "Turret",  code: turretCode  },
    extraOpponents: [{ id: "opp-4b", name: "Wanderer", code: wandererCode }],
    demo: {
      player:         { id: "demo-p",  name: "You",     code: d6Code      },
      opponent:       { id: "demo-o1", name: "Turret",  code: turretCode  },
      extraOpponents: [{ id: "demo-o2", name: "Wanderer", code: wandererCode }],
    },
  },
  {
    index: 5,
    title: "Lead your shots",
    blurb: "The Sprinter moves in fast, predictable horizontal passes — but if you aim directly " +
      "at it, your bullets arrive after it has already moved on. " +
      "Use bulletSpeed() to calculate where it will be when your bullet arrives, then aim there.",
    snippet:
`async run() {
  while (true) {
    const target = this.enemies.find(e => e.visible && e.alive);
    if (!target) { await this.step({ turn: 10 }); continue; }

    const speed = this.bulletSpeed(1.5);
    const ticks = this.distanceTo(target) / speed;
    const rad   = target.heading * Math.PI / 180;
    const predX = target.x + Math.sin(rad) * target.velocity * ticks;
    const predY = target.y - Math.cos(rad) * target.velocity * ticks;

    await this.step({
      gunTurn: this.gunBearingTo({ x: predX, y: predY }),
      fire: this.gunHeat === 0,
      firePower: 1.5,
    });
  }
}`,
    opponent: { id: "opp-5", name: "Sprinter", code: sprinterCode },
    demo: {
      player:   { id: "demo-p", name: "You", code: d7Code },
      opponent: { id: "demo-o", name: "Sprinter", code: sprinterCode },
    },
  },
  {
    index: 6,
    title: "Use the terrain",
    blurb: "The Sniper keeps its distance and fires maximum-power shots — one hit takes off " +
      "your entire shield and a chunk of your energy. Obstacles block both bullets and line of sight. " +
      "Position yourself behind cover and only expose yourself to fire when you have a clear shot.",
    snippet:
`async run() {
  while (true) {
    const target = this.enemies.find(e => e.alive);
    const obs = this.obstacles[0];
    if (obs) {
      const cx = obs.reduce((s, v) => s + v.x, 0) / obs.length;
      const cy = obs.reduce((s, v) => s + v.y, 0) / obs.length;
      const coverDist = this.distanceTo({ x: cx, y: cy });
      await this.step({
        velocity: coverDist > 60 ? 6 : 0,
        turn: coverDist > 60
          ? this.bearingTo({ x: cx, y: cy })
          : this.bearingTo(target ?? { x: cx, y: cy }),
        gunTurn: target ? this.gunBearingTo(target) : 0,
        fire: target?.visible && this.gunHeat === 0,
        firePower: 2,
      });
    }
  }
}`,
    opponent: { id: "opp-6", name: "Sniper", code: sniperCode },
    withObstacles: true,
    demo: {
      player:   { id: "demo-p", name: "You", code: d8Code },
      opponent: { id: "demo-o", name: "Sniper", code: sniperCode },
    },
  },
];

export const CHALLENGE_COUNT = CHALLENGES.length;
