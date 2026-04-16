export const TRACKER_BOT_NAME = "Tracker";

export const TRACKER_BOT_CODE = `class MyRobot extends Robot {
  constructor() {
    super();
    this._target = null;
  }

  async run() {
    while (true) {
      await this.turnRadar(45);
      if (this._target) {
        await this.turnGun(this._target.bearing);
        await this.fire(2);
        this._target = null;
      }
      await this.move(50);
      await this.turn(-20);
    }
  }

  onScannedRobot(e) {
    this._target = e;
    this.fire(1);
  }
}`;
