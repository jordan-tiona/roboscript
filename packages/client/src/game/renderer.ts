import type { GameState } from "@roboscript/engine";
import { BOT_RADIUS, BULLET_RADIUS, ARENA_WIDTH, ARENA_HEIGHT, SHIELD_MAX, ZONE_START_TICK, ZONE_START_RADIUS } from "@roboscript/engine";

const BOT_COLORS = ["#4fc3f7", "#ef5350", "#66bb6a", "#ffa726", "#ce93d8", "#80cbc4"];

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, r + Math.round((255 - r) * amount));
  const lg = Math.min(255, g + Math.round((255 - g) * amount));
  const lb = Math.min(255, b + Math.round((255 - b) * amount));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

/** Extra pixels added around the arena so UI elements (health bars, names)
 *  aren't clipped when bots are near the edge. */
export const CANVAS_PADDING = 32;

// Returns the shadow quad cast behind `poly` from viewpoint (vx, vy).
// Uses the largest angular gap between vertices to find the two silhouette vertices.
function obstacleShadow(
  vx: number, vy: number,
  poly: readonly { x: number; y: number }[],
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] | null {
  if (poly.length < 2) return null;
  const angles = poly.map(v => Math.atan2(v.y - vy, v.x - vx));
  const sorted = angles.map((a, i) => ({ a, i })).sort((p, q) => p.a - q.a);
  let maxGap = 0, gapIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const ni = (i + 1) % sorted.length;
    const gap = ni === 0
      ? sorted[0]!.a + Math.PI * 2 - sorted[i]!.a
      : sorted[ni]!.a - sorted[i]!.a;
    if (gap > maxGap) { maxGap = gap; gapIdx = i; }
  }
  const s1 = poly[sorted[gapIdx]!.i]!;
  const s2 = poly[sorted[(gapIdx + 1) % sorted.length]!.i]!;
  const FAR = 2500;
  const d1x = s1.x - vx, d1y = s1.y - vy, l1 = Math.hypot(d1x, d1y);
  const d2x = s2.x - vx, d2y = s2.y - vy, l2 = Math.hypot(d2x, d2y);
  if (l1 === 0 || l2 === 0) return null;
  return [
    s1,
    { x: s1.x + (d1x / l1) * FAR, y: s1.y + (d1y / l1) * FAR },
    { x: s2.x + (d2x / l2) * FAR, y: s2.y + (d2y / l2) * FAR },
    s2,
  ];
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  const p = CANVAS_PADDING;
  const aW = state.arenaWidth;
  const aH = state.arenaHeight;

  // Background — fill entire canvas including padding
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, w, h);

  // Offset all subsequent drawing into the padded arena area
  ctx.save();
  ctx.translate(p, p);

  // Grid (subtle)
  ctx.strokeStyle = "#1a1a3e";
  ctx.lineWidth = 1;
  for (let x = 0; x <= aW; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, aH); ctx.stroke();
  }
  for (let y = 0; y <= aH; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(aW, y); ctx.stroke();
  }

  // Arena border
  ctx.strokeStyle = "#3a3a6e";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, aW - 3, aH - 3);

  // Zone
  const zoneR = state.zoneRadius;
  const zoneCx = aW / 2;
  const zoneCy = aH / 2;
  const zoneActive = state.tick >= ZONE_START_TICK;
  const zoneWarning = !zoneActive && state.tick >= ZONE_START_TICK - 300; // 10s warning

  if (zoneActive && zoneR > 0) {
    // Dark overlay outside the safe zone
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, aW, aH);
    ctx.arc(zoneCx, zoneCy, zoneR, 0, Math.PI * 2, true); // true = counter-clockwise cuts a hole
    ctx.fillStyle = "rgba(120, 0, 0, 0.28)";
    ctx.fill("evenodd");
    ctx.restore();

    // Glowing ring
    const pulse = (Math.sin(state.tick * 0.15) + 1) / 2;
    ctx.beginPath();
    ctx.arc(zoneCx, zoneCy, zoneR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 2 + pulse * 2;
    ctx.shadowColor = "#ff3030";
    ctx.shadowBlur = 8 + pulse * 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (zoneWarning) {
    // Faint pre-warning ring at full size
    const warnPulse = (Math.sin(state.tick * 0.1) + 1) / 2;
    ctx.beginPath();
    ctx.arc(zoneCx, zoneCy, ZONE_START_RADIUS * Math.max(aW / ARENA_WIDTH, aH / ARENA_HEIGHT), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 140, 0, ${0.15 + warnPulse * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Zone label (top-center of arena)
  if (zoneActive || zoneWarning) {
    const ticksLeft = ZONE_START_TICK - state.tick;
    const label = zoneActive
      ? zoneR <= 0 ? "ZONE CLOSED" : `zone r=${Math.round(zoneR)}`
      : `zone in ${Math.ceil(ticksLeft / 30)}s`;
    const labelAlpha = zoneWarning ? 0.5 + ((Math.sin(state.tick * 0.15) + 1) / 2) * 0.4 : 0.7;
    ctx.globalAlpha = labelAlpha;
    ctx.fillStyle = zoneActive ? "#ff6060" : "#ffa040";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, aW / 2, 16);
    ctx.globalAlpha = 1;
  }

  // Obstacles
  for (const poly of state.obstacles) {
    ctx.beginPath();
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
    ctx.closePath();
    ctx.fillStyle = "#1e1e40";
    ctx.fill();
    ctx.strokeStyle = "#4a4a8e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Per-bot vision: fill arena in bot color, clip out obstacle shadows (even-odd rule)
  state.bots.forEach((bot, i) => {
    if (!bot.isAlive) return;
    const color = BOT_COLORS[i % BOT_COLORS.length] ?? "#fff";
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, aW, aH); // base: full arena visible
    for (const obs of state.obstacles) {
      // Obstacle body
      ctx.moveTo(obs[0]!.x, obs[0]!.y);
      for (let k = 1; k < obs.length; k++) ctx.lineTo(obs[k]!.x, obs[k]!.y);
      ctx.closePath();
      // Shadow quad behind obstacle
      const shadow = obstacleShadow(bot.position.x, bot.position.y, obs);
      if (shadow) {
        ctx.moveTo(shadow[0].x, shadow[0].y);
        ctx.lineTo(shadow[1].x, shadow[1].y);
        ctx.lineTo(shadow[2].x, shadow[2].y);
        ctx.lineTo(shadow[3].x, shadow[3].y);
        ctx.closePath();
      }
    }
    ctx.clip("evenodd");
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, aW, aH);
    ctx.restore();
  });

  // Bullets
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.position.x, bullet.position.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#fff176";
    ctx.shadowColor = "#ffeb3b";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bots
  state.bots.forEach((bot, i) => {
    const color = BOT_COLORS[i % BOT_COLORS.length] ?? "#fff";
    const { x, y } = bot.position;

    ctx.save();
    ctx.translate(x, y);

    if (bot.isAlive) {
      // ── Body (rectangle, rotates with heading) ───────────────────────────
      ctx.save();
      ctx.rotate((bot.heading * Math.PI) / 180);

      // Treads — darkened side panels behind the main body
      ctx.fillStyle = darkenColor(color, 0.45);
      ctx.fillRect(-13, -15, 5, 30);   // left tread
      ctx.fillRect(8,   -15, 5, 30);   // right tread
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.strokeRect(-13, -15, 5, 30);
      ctx.strokeRect(8,   -15, 5, 30);

      // Hull
      ctx.fillStyle = color;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-8, -15, 16, 30);
      ctx.strokeRect(-8, -15, 16, 30);

      // Front edge highlight so the facing direction is obvious
      ctx.strokeStyle = lightenColor(color, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -15);
      ctx.lineTo(8, -15);
      ctx.stroke();

      ctx.restore();

      // ── Turret (triangle) + barrel (rotate with gunHeading) ──────────────
      ctx.save();
      ctx.rotate((bot.gunHeading * Math.PI) / 180);

      // Barrel — drawn first so triangle overlaps its base
      ctx.fillStyle = lightenColor(color, 0.55);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.fillRect(-2.5, -26, 5, 14);
      ctx.strokeRect(-2.5, -26, 5, 14);

      // Turret triangle: tip forward (−y), base behind
      ctx.beginPath();
      ctx.moveTo(0, -12);   // tip — points in gun heading direction
      ctx.lineTo(-9, 8);    // back-left corner
      ctx.lineTo(9,  8);    // back-right corner
      ctx.closePath();
      ctx.fillStyle = lightenColor(color, 0.35);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    } else {
      // Dead bot wreckage — faded rectangle at last heading
      ctx.save();
      ctx.rotate((bot.heading * Math.PI) / 180);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#555";
      ctx.fillRect(-13, -15, 26, 30);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.restore();

    if (bot.isAlive) {
      // Health bar
      const barW = BOT_RADIUS * 2 + 4;
      const barH = 5;
      const barX = x - barW / 2;
      const barY = y - BOT_RADIUS - 14;
      ctx.fillStyle = "#222";
      ctx.fillRect(barX, barY, barW, barH);
      const pct = Math.max(0, bot.energy / 100);
      ctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ff9800" : "#f44336";
      ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // Shield bar
      const sbY = barY + barH + 1;
      const shieldPct = Math.max(0, bot.shield / SHIELD_MAX);
      const shieldRegen = bot.shieldCooldown === 0 && bot.shield < SHIELD_MAX;
      const shieldCooldown = bot.shieldCooldown > 0;
      ctx.fillStyle = "#222";
      ctx.fillRect(barX, sbY, barW, barH);
      if (shieldPct > 0) {
        ctx.fillStyle = shieldCooldown ? "#546e7a" : "#42a5f5";
        ctx.fillRect(barX, sbY, barW * shieldPct, barH);
      }
      if (shieldRegen) {
        const pulse = (Math.sin(state.tick * 0.25) + 1) / 2;
        ctx.shadowBlur = 3 + pulse * 7;
        ctx.shadowColor = "#90caf9";
        ctx.strokeStyle = `rgba(144, 202, 249, ${0.4 + pulse * 0.6})`;
      } else {
        ctx.strokeStyle = "#444";
      }
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, sbY, barW, barH);
      ctx.shadowBlur = 0;

      // Bot name
      ctx.fillStyle = color;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(bot.name, x, barY - 4);
    }
  });

  // Tick counter (inside arena, bottom-left)
  ctx.fillStyle = "#444";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`tick ${state.tick}`, 8, ARENA_HEIGHT - 8);

  // Restore translation before full-canvas overlays
  ctx.restore();

  // Win message — covers full canvas including padding
  if (state.isOver) {
    const winner = state.bots.find((b) => b.id === state.winnerId);
    const msg = winner ? `${winner.name} wins!` : "Draw!";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.fillText(msg, w / 2, h / 2);
    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("Press Reset to play again", w / 2, h / 2 + 36);
  }
}
