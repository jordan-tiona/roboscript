export const DEFAULT_BOT_NAME = "MyRobot";

export const DEFAULT_BOT_CODE = `class MyRobot extends Robot {
  async run() {
    while (true) {
      await this.turn(15);
      await this.move(100);
      await this.turnGun(360);
    }
  }

  onScannedRobot(e) {
    this.fire(Math.min(3, e.energy / 10));
  }

  onHitWall() {
    this.turn(45);
  }
}`;
