class Dummy extends RobotRuntime {
  async run() {
    while (true) {
      await this.step({
        gunTurn: (Math.random() - 0.5) * 40,
        fire: this.gunHeat === 0,
        firePower: 0.5,
      });
    }
  }
}
