// Maintains long range and fires powerful shots. Cover breaks its line of sight.
class Sniper extends RobotRuntime {
  // Project the backing direction REACH pixels ahead. If it exits the arena,
  // use the cross product of the backing vector and the inward wall normal to
  // pick a decisive CW (+10) or CCW (-10) correction with no ambiguous cases.
  wallAvoid() {
    const REACH = 70;
    const rad = ((this.heading + 180) % 360) * Math.PI / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const px = this.x + dx * REACH;
    const py = this.y + dy * REACH;
    const aw = this.arenaWidth, ah = this.arenaHeight;
    if (px >= 0 && px <= aw && py >= 0 && py <= ah) return 0;
    // Inward wall normal at the violated boundary
    let nx = 0, ny = 0;
    if (px < 0)   nx =  1;
    else if (px > aw) nx = -1;
    if (py < 0)   ny =  1;
    else if (py > ah) ny = -1;
    // Cross product sign: positive → wall normal is left of backing → turn CW
    const cross = dx * ny - dy * nx;
    return cross >= 0 ? 10 : -10;
  }

  async run() {
    while (true) {
      const target = this.enemies.find(e => e.alive);
      if (!target) { await this.step({ turn: 8 }); continue; }

      const preferred = this.arenaWidth * 0.55;
      const dist = this.distanceTo(target);
      const vel = dist < preferred - 40 ? -5 : dist > preferred + 40 ? 4 : 0;
      const wall = this.wallAvoid();
      const gb = this.gunBearingTo(target);
      await this.step({
        velocity: vel,
        turn: this.bearingTo(target) * (wall !== 0 ? 0.1 : 0.25) + wall,
        gunTurn: target.visible ? gb : 10,
        fire: target.visible && this.gunHeat === 0 && Math.abs(gb) < 6,
        firePower: 3,
      });
    }
  }
}
