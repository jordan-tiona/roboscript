// Moves in fast, consistent horizontal passes — naively aimed shots fly behind it.
class Sprinter extends RobotRuntime {
  _dir = 1;

  async run() {
    while (true) {
      if (this.x < 80) this._dir = 1;
      if (this.x > this.arenaWidth - 80) this._dir = -1;

      const dest = { x: this.x + this._dir * 400, y: this.arenaHeight / 2 };
      const target = this.enemies.find(e => e.alive);
      await this.step({
        velocity: 8,
        turn: this.bearingTo(dest),
        gunTurn: target ? this.gunBearingTo(target) : 5,
        fire: this.gunHeat === 0,
        firePower: 1,
      });
    }
  }
}
