import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ARENA_WIDTH, ARENA_HEIGHT } from "@roboscript/engine";
import { CANVAS_PADDING } from "../game/renderer";

export interface ArenaHandle {
  getCanvas(): HTMLCanvasElement | null;
}

export const Arena = forwardRef<ArenaHandle>(function Arena(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = ARENA_WIDTH + CANVAS_PADDING * 2;
    const h = ARENA_HEIGHT + CANVAS_PADDING * 2;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = CANVAS_PADDING;
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(p, p);
    ctx.strokeStyle = "#1a1a3e";
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA_WIDTH; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_WIDTH, y); ctx.stroke();
    }
    ctx.strokeStyle = "#3a3a6e";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, ARENA_WIDTH - 3, ARENA_HEIGHT - 3);
    ctx.restore();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        border: "2px solid #3a3a6e",
        borderRadius: "4px",
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    />
  );
});
