// Maintains long range and fires powerful shots. Cover breaks its line of sight.
class Sniper extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive);
      if (!target) { await this.step({ turn: 8 }); continue; }

      const dist = this.distanceTo(target);
      const vel = dist < 300 ? -5 : dist > 420 ? 4 : 0;
      const gb = this.gunBearingTo(target);
      await this.step({
        velocity: vel,
        turn: this.bearingTo(target) * 0.25,
        gunTurn: target.visible ? gb : 10,
        fire: target.visible && this.gunHeat === 0 && Math.abs(gb) < 6,
        firePower: 3,
      });
    }
  }
}
