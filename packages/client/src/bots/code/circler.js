class MyRobot extends Robot {
  async run() {
    while (true) {
      // Find the nearest visible enemy
      const target = this.enemies
        .filter(e => e.alive && e.visible)
        .sort((a, b) => this.distanceTo(a) - this.distanceTo(b))[0];

      // Continuously circle the arena
      this.setAhead(6);
      this.setTurn(8);

      if (target) {
        // Rotate gun toward target one step independently of body
        const delta = this.gunBearingTo(target);
        this.setTurnGun(Math.sign(delta) * Math.min(Math.abs(delta), 20));

        if (this.gunHeat === 0) this.setFire();
      }

      await this.execute();
    }
  }
}
