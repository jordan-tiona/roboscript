// Demonstrates shot leading: aims at where the Sprinter will be, not where it is.
class DemoPredictor extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive)
      if (!target) { await this.step({ turn: 5 }); continue; }
      const power = 1.5
      const ticks = this.distanceTo(target) / this.bulletSpeed(power)
      const rad = target.heading * Math.PI / 180
      const predX = target.x + Math.sin(rad) * target.velocity * ticks
      const predY = target.y - Math.cos(rad) * target.velocity * ticks
      await this.step({
        gunTurn: this.gunBearingTo({ x: predX, y: predY }),
        fire: this.gunHeat === 0,
        firePower: power,
      })
    }
  }
}
