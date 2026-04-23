class DemoCircler extends RobotRuntime {
  direction = 1
  distance = 80
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive)
      if (target) {
        const correction = (this.distanceTo(target) - this.distance) / (20 * this.direction)
        this.setTurn(this.bearingTo(target) - 90 + correction)
        this.setAhead(30)
        this.setTurnGun(this.gunBearingTo(target))
        if (this.gunHeat === 0) this.setFire(1)
      }
      await this.execute()
    }
  }
  onHitWall() { this.direction *= -1; this.setAhead(0) }
}
