import type { GameState } from "@roboscript/engine";
import { BOT_RADIUS, BULLET_RADIUS, ARENA_WIDTH, ARENA_HEIGHT } from "@roboscript/engine";

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

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  const p = CANVAS_PADDING;

  // Background — fill entire canvas including padding
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, w, h);

  // Offset all subsequent drawing into the padded arena area
  ctx.save();
  ctx.translate(p, p);

  // Grid (subtle)
  ctx.strokeStyle = "#1a1a3e";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= ARENA_HEIGHT; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_WIDTH, y); ctx.stroke();
  }

  // Arena border
  ctx.strokeStyle = "#3a3a6e";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, ARENA_WIDTH - 3, ARENA_HEIGHT - 3);

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
