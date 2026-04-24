// Demonstrates terrain use: orbits while firing when the target is visible,
// and orbits the nearest obstacle to peek around it when the target disappears.
class DemoCover extends RobotRuntime {
  moveDir = 1

  onHitWall() { this.moveDir *= -1 }
  onHitObstacle() { this.moveDir *= -1 }

  obsCenterOf(obs) {
    return {
      x: obs.reduce((s, v) => s + v.x, 0) / obs.length,
      y: obs.reduce((s, v) => s + v.y, 0) / obs.length,
    }
  }

  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive)
      if (!target) { await this.step({ velocity: 2 + Math.random() * 4, turn: 10 }); continue; }

      if (target.visible) {
        const correction = Math.max(-60, Math.min(60, (this.distanceTo(target) - 120) / 5))
        await this.step({
          velocity: this.moveDir * (2 + Math.random() * 4),
          turn: this.bearingTo(target) - 90 + correction,
          gunTurn: this.gunBearingTo(target),
          fire: this.gunHeat === 0,
          firePower: 2,
        })
      } else {
        // lost sight — orbit the nearest obstacle to peek around it
        const obs = this.obstacles
          .map(o => ({ o, c: this.obsCenterOf(o) }))
          .sort((a, b) => this.distanceTo(a.c) - this.distanceTo(b.c))[0]
        const center = obs ? obs.c : { x: 200, y: 150 }
        const correction = Math.max(-60, Math.min(60, (this.distanceTo(center) - 80) / 5))
        await this.step({
          velocity: this.moveDir * 5,
          turn: this.bearingTo(center) - 90 + correction,
          gunTurn: target ? this.gunBearingTo(target) : 10,
        })
      }
    }
  }
}
