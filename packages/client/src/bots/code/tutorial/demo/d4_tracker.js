// Demo: uses enemies[] to track and chase the wanderer
class DemoTracker extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive);
      if (!target) { await this.step({ turn: 10 }); continue; }
      await this.step({
        velocity: 6,
        turn: this.bearingTo(target),
        gunTurn: this.gunBearingTo(target),
        fire: this.gunHeat === 0 && Math.abs(this.gunBearingTo(target)) < 8,
        firePower: 1,
      });
    }
  }
}
