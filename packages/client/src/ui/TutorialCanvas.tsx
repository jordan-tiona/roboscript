import { useEffect, useRef } from "react";
import { GameLoop } from "../game/GameLoop.js";
import type { BotEntry } from "../game/GameDriver.js";
import { DEMO_ARENA } from "../tutorial/challenges.js";
import { CANVAS_PADDING } from "../game/renderer.js";

interface Props {
  player: BotEntry;
  opponent: BotEntry;
  extraOpponents?: BotEntry[];
  withObstacles?: boolean;
}

// Show a cropped, slightly zoomed-out view of the arena center.
const SCALE = 0.85;

export const DISPLAY_W = 400;
export const DISPLAY_H = 300;

export function TutorialCanvas({ player, opponent, extraOpponents = [], withObstacles = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef   = useRef<GameLoop | null>(null);
  const aliveRef  = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function runGame() {
      if (!aliveRef.current || !canvasRef.current) return;
      const bots = [player, opponent, ...extraOpponents];
      const arenaOpts = { ...DEMO_ARENA, obstacles: withObstacles };
      const loop = new GameLoop(canvasRef.current, bots, () => {
        if (aliveRef.current) setTimeout(runGame, 2000);
      }, undefined, arenaOpts);
      loopRef.current = loop;
      await loop.start(bots);
    }

    runGame();

    return () => {
      aliveRef.current = false;
      loopRef.current?.stop();
      loopRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas buffer is set by GameLoop to (arenaW + padding*2) × (arenaH + padding*2).
  // Scale down and offset so only the center portion of the arena is visible —
  // bots have room to roam the full arena without the edges being on-screen.
  const logicalW = DEMO_ARENA.arenaWidth  + CANVAS_PADDING * 2;
  const logicalH = DEMO_ARENA.arenaHeight + CANVAS_PADDING * 2;
  const cssW = logicalW * SCALE;
  const cssH = logicalH * SCALE;
  // Align the arena center to the display center
  const marginLeft = DISPLAY_W / 2 - (CANVAS_PADDING + DEMO_ARENA.arenaWidth  / 2) * SCALE;
  const marginTop  = DISPLAY_H / 2 - (CANVAS_PADDING + DEMO_ARENA.arenaHeight / 2) * SCALE;

  return (
    <div style={{ width: DISPLAY_W, height: DISPLAY_H, overflow: "hidden", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: cssW, height: cssH, marginLeft, marginTop }}
      />
    </div>
  );
}
