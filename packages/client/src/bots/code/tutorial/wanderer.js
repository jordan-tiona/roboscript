class Wanderer extends RobotRuntime {
  _turnDir = 1;
  _ticksThisDir = 0;

  async run() {
    while (true) {
      this._ticksThisDir++;
      if (this._ticksThisDir > 20 + Math.random() * 40) {
        this._turnDir *= -1;
        this._ticksThisDir = 0;
      }
      if (this.hitWall) this._turnDir *= -1;

      const target = this.enemies.find(e => e.alive && e.visible);
      await this.step({
        velocity: 5,
        turn: this._turnDir * 7,
        gunTurn: target ? this.gunBearingTo(target) : 10,
        fire: target && this.gunHeat === 0 && Math.abs(this.gunBearingTo(target)) < 10,
        firePower: 1,
      });
    }
  }
}
