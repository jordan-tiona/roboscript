class MyRobot extends Robot {
  async run() {
    // Turn to face the nearest wall head-on so the 90° hug turn lands correctly
    const ARENA_W = 800, ARENA_H = 600;
    const walls = [
      { heading: 0,   dist: this.y },
      { heading: 90,  dist: ARENA_W - this.x },
      { heading: 180, dist: ARENA_H - this.y },
      { heading: 270, dist: this.x },
    ];
    const nearest = walls.sort((a, b) => a.dist - b.dist)[0];
    const turnAngle = ((nearest.heading - this.heading + 540) % 360) - 180;
    await this.turn(turnAngle);

    // Drive to the wall, then turn 90° to begin hugging it
    while (!this.hitWall) {
      this.setAhead(8);
      await this.execute();
    }
    await this.turn(90);

    while (true) {
      const target = this.enemies
        .filter(e => e.alive && e.visible)
        .sort((a, b) => this.distanceTo(a) - this.distanceTo(b))[0];

      if (target) {
        // Aim at where the enemy will be when the bullet arrives
        const aim = this.#predictPosition(target);
        const delta = this.gunBearingTo(aim);
        this.setTurnGun(Math.sign(delta) * Math.min(Math.abs(delta), 20));
        if (this.gunHeat === 0 && Math.abs(delta) < 5) this.setFire();
      }

      this.setAhead(8);
      await this.execute();

      // Turn clockwise along each wall
      if (this.hitWall) {
        await this.turn(90);
      }
    }
  }

  // Predict where `enemy` will be when a bullet fired now reaches it.
  // Solves: distance(myPos, enemyPos + vel*t) = BULLET_SPEED * t
  // Expanding gives a quadratic in t; we take the smallest positive root.
  #predictPosition(enemy) {
    const BULLET_SPEED = 15;
    const rad = enemy.heading * Math.PI / 180;
    const vx = enemy.velocity * Math.sin(rad);
    const vy = -enemy.velocity * Math.cos(rad);
    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;

    const a = vx * vx + vy * vy - BULLET_SPEED * BULLET_SPEED;
    const b = 2 * (dx * vx + dy * vy);
    const c = dx * dx + dy * dy;

    let t = 0;
    if (Math.abs(a) < 1e-6) {
      // Degenerate: enemy speed ~= bullet speed, solve linearly
      t = b !== 0 ? -c / b : 0;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (-b + sq) / (2 * a);
        const t2 = (-b - sq) / (2 * a);
        // Prefer the smallest positive solution
        if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
        else t = Math.max(t1, t2);
      }
    }

    if (t <= 0) return enemy;
    return { x: enemy.x + vx * t, y: enemy.y + vy * t };
  }
}