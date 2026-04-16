export const DEFAULT_BOT_NAME = "MyRobot";

export const DEFAULT_BOT_CODE = `class MyRobot extends Robot {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive);

      if (target) {
        // Aim the turret toward the target and fire when ready
        const delta = ((this.angleTo(target) - this.gunHeading + 540) % 360) - 180;
        this.setTurnGun(Math.sign(delta) * Math.min(Math.abs(delta), 20));
        if (this.gunHeat === 0) this.setFire();
      } else {
        // No target in sight — patrol
        this.setTurn(15);
        this.setAhead(4);
      }

      await this.execute();
    }
  }
}`;
