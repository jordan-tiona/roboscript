// Demonstrates unpredictable movement: orbits like the stepper but reverses
// after a random distance so linear prediction can't track it.
class DemoRandom extends RobotRuntime {
  direction = 1
  distance = 140
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive)

      if (target) {
        const correction = (this.distanceTo(target) - this.distance)/(5 * this.direction)
        this.setTurn(this.bearingTo(target) - 90 + correction)
        if (this.remainingAhead === 0) {
          this.direction *= -1
          this.setMove((40 + Math.random() * 100) * this.direction)
        }
        this.setTurnGun(this.gunBearingTo(target))
      }

      if (this.gunHeat === 0) {
        this.setFire(1)
      }
      await this.execute();
    }
  }

  onHitWall(e) {
    this.direction *= -1
    this.setAhead(0)
  }
}