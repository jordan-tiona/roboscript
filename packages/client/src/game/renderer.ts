import type { GameState } from "@roboscript/engine";
import { BOT_RADIUS, BULLET_RADIUS } from "@roboscript/engine";

const BOT_COLORS = ["#4fc3f7", "#ef5350", "#66bb6a", "#ffa726", "#ce93d8", "#80cbc4"];

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
): void {
  // Background
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, w, h);

  // Grid (subtle)
  ctx.strokeStyle = "#1a1a3e";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Arena border
  ctx.strokeStyle = "#3a3a6e";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

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
      // Radar arc
      const radarRad = (bot.radarHeading * Math.PI) / 180 - Math.PI / 2;
      const halfArc = (22.5 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 90, radarRad - halfArc, radarRad + halfArc);
      ctx.closePath();
      ctx.fillStyle = `${color}18`;
      ctx.fill();
      ctx.strokeStyle = `${color}40`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Body
      ctx.beginPath();
      ctx.arc(0, 0, BOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tread marks
      ctx.save();
      ctx.rotate((bot.heading * Math.PI) / 180);
      ctx.fillStyle = "#00000044";
      ctx.fillRect(-BOT_RADIUS, -BOT_RADIUS * 0.6, BOT_RADIUS * 0.35, BOT_RADIUS * 1.2);
      ctx.fillRect(BOT_RADIUS * 0.65, -BOT_RADIUS * 0.6, BOT_RADIUS * 0.35, BOT_RADIUS * 1.2);
      ctx.restore();

      // Gun barrel
      ctx.save();
      ctx.rotate((bot.gunHeading * Math.PI) / 180);
      ctx.fillStyle = "#ddd";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.fillRect(-3, -BOT_RADIUS - 10, 6, 14);
      ctx.strokeRect(-3, -BOT_RADIUS - 10, 6, 14);
      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
    } else {
      // Dead bot wreckage
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, BOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#555";
      ctx.fill();
      ctx.globalAlpha = 1;
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

  // Tick counter
  ctx.fillStyle = "#444";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`tick ${state.tick}`, 8, h - 8);

  // Win message
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
