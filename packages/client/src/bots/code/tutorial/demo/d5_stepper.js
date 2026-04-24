// Demonstrates step(): move, turn body, turn gun, and fire all in the same tick.
class DemoStepper extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive)
      if (!target) { await this.step({ velocity: 6, turn: 8 }); continue; }
      const correction = Math.max(-60, Math.min(60, (this.distanceTo(target) - 120) / 5))
      await this.step({
        velocity: 6,
        turn: this.bearingTo(target) - 90 + correction,
        gunTurn: this.gunBearingTo(target),
        fire: this.gunHeat === 0,
        firePower: 1.5,
      })
    }
  }
}
