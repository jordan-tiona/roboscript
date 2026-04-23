class DemoMover extends RobotRuntime {
  direction = 1
  distance = 100
  async run() {
    this.setMove(this.distance)
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive)
      if (target) {
        const correction = (this.distanceTo(target) - this.distance) / (20 * this.direction)
        this.setTurn(this.bearingTo(target) - 90 + correction)
        if (this.remainingAhead === 0) {
          this.direction *= -1
          this.setMove((40 + Math.random() * 80) * this.direction)
        }
        this.setTurnGun(this.gunBearingTo(target))
        if (this.gunHeat === 0) this.setFire(1)
      }
      await this.execute()
    }
  }
  onHitWall() { this.direction *= -1; this.setAhead(0) }
}
