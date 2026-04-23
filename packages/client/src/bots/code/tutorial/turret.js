class Turret extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive && e.visible);
      if (target) {
        await this.step({
          gunTurn: this.gunBearingTo(target),
          fire: this.gunHeat === 0 && Math.abs(this.gunBearingTo(target)) < 4,
          firePower: 1.5,
        });
      } else {
        await this.step({ gunTurn: 10 });
      }
    }
  }
}
