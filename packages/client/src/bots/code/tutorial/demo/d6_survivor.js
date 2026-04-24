// Demonstrates multi-target prioritization with unpredictable movement.
class DemoSurvivor extends RobotRuntime {
    direction = 1
  distance = 140
  async run() {
    while (true) {
      const target = this.enemies.filter(e => (
        e.visible && e.alive)).sort(
        (a, b) => (this.distanceTo(a) - this.distanceTo(b))
      )[0]

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
