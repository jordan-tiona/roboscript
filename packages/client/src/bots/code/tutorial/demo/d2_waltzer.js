// Demonstrates constant movement: waltz north/south, aiming and firing at each end.
class DemoWaltzer extends RobotRuntime {
  async run() {
    const toNorth = ((0   - this.heading + 540) % 360) - 180
    const toSouth = ((180 - this.heading + 540) % 360) - 180
    await this.turn(Math.abs(toNorth) <= Math.abs(toSouth) ? toNorth : toSouth)
    while (true) {
      const target = this.enemies.find(e => e.alive)
      await this.move(90)
      if (target) {
        await this.aimToward(target)
        if (this.gunHeat === 0) await this.fire(1)
      }
      await this.move(-90)
      if (target) {
        await this.aimToward(target)
        if (this.gunHeat === 0) await this.fire(1)
      }
    }
  }
}
