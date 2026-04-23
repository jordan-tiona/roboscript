// Charges the player and fires steadily. Sequential movement gets punished.
class Duelist extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive);
      if (!target) { await this.step({ velocity: 8, turn: 5 }); continue; }

      const dist = this.distanceTo(target);
      const vel = dist > 160 ? 8 : dist < 80 ? -4 : 3;
      await this.step({
        velocity: vel,
        turn: this.bearingTo(target),
        gunTurn: this.gunBearingTo(target),
        fire: this.gunHeat === 0,
        firePower: 2,
      });
    }
  }
}
