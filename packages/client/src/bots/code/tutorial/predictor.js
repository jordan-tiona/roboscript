// Stationary. Uses linear prediction to lead shots — consistent movement is fatal.
class Predictor extends RobotRuntime {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive && e.visible);
      if (target) {
        const speed = this.bulletSpeed(1.5);
        const dist = this.distanceTo(target);
        const ticks = dist / speed;
        const rad = target.heading * Math.PI / 180;
        const predX = target.x + Math.sin(rad) * target.velocity * ticks;
        const predY = target.y - Math.cos(rad) * target.velocity * ticks;
        const gb = this.gunBearingTo({ x: predX, y: predY });
        await this.step({
          gunTurn: gb,
          fire: this.gunHeat === 0 && Math.abs(gb) < 5,
          firePower: 1.5,
        });
      } else {
        await this.step({ gunTurn: 8 });
      }
    }
  }
}
