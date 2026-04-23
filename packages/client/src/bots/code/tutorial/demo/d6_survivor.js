class DemoSurvivor extends RobotRuntime {
  direction = 1
  distance = 100
  async run() {
    this.setMove(this.distance)
    while (true) {
      const alive = this.enemies.filter(e => e.alive)
      const target = alive.slice().sort((a, b) => this.distanceTo(a) - this.distanceTo(b))[0]
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
