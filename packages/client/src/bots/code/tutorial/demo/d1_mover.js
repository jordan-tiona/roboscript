// Demonstrates basic movement: aim at the target, fire, move forward, turn.
class DemoMover extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive)
      if (target) {
        await this.aimToward(target)
        if (this.gunHeat === 0) await this.fire(1)
      }
      await this.move(50)
      await this.turn(90)
    }
  }
}
