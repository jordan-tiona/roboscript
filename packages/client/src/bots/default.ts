export const DEFAULT_BOT_NAME = "MyRobot";

export const DEFAULT_BOT_CODE = `class MyRobot extends Robot {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.visible && e.alive);
      if (target) {
        await this.turnToward(target);
        await this.fire();
      } else {
        await this.turn(20);
        await this.move(100);
      }
    }
  }

  onHitWall() {
    this.turn(45);
  }
}`;
