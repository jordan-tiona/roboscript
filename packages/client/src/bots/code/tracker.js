class MyRobot extends Robot {
  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive && e.visible)
                  ?? this.enemies.find(e => e.alive && e.lastSeen !== null);

      if (target) {
        await this.aimToward(target);
        await this.fire();
        await this.move(80);
        await this.turn(20);
      } else {
        await this.turn(30);
        await this.move(100);
      }
    }
  }
}
