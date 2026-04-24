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

export const DISPLAY_W = 400;
export const DISPLAY_H = 300;

const DEMO_RESET_MS = 5000;

export function TutorialCanvas({ player, opponent, extraOpponents = [], withObstacles = false }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const loopRef    = useRef<GameLoop | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef   = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    function stop() {
      if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
      loopRef.current?.stop();
      loopRef.current = null;
    }

    async function runGame() {
      if (!aliveRef.current || !canvasRef.current) return;
      const bots = [player, opponent, ...extraOpponents];
      const aw = DEMO_ARENA.arenaWidth;
      const ah = DEMO_ARENA.arenaHeight;
      // Spread bots: player at 25% x, opponent at 75% x, extras stacked at 75% x top/bottom
      const spawnPositions = [
        { x: aw * 0.25, y: ah * 0.5  },
        { x: aw * 0.75, y: ah * 0.5  },
        { x: aw * 0.75, y: ah * 0.25 },
        { x: aw * 0.25, y: ah * 0.75 },
      ].slice(0, bots.length);

      // For the obstacles demo: one small fixed obstacle between the two bots
      const fixedObstacles = withObstacles ? [[
        { x: aw * 0.5 - 30, y: ah * 0.5 - 40 },
        { x: aw * 0.5 + 30, y: ah * 0.5 - 40 },
        { x: aw * 0.5 + 40, y: ah * 0.5      },
        { x: aw * 0.5 + 30, y: ah * 0.5 + 40 },
        { x: aw * 0.5 - 30, y: ah * 0.5 + 40 },
        { x: aw * 0.5 - 40, y: ah * 0.5      },
      ]] : undefined;
      const arenaOpts = { ...DEMO_ARENA, obstacles: withObstacles, spawnPositions, fixedObstacles };
      const loop = new GameLoop(canvasRef.current, bots, undefined, undefined, arenaOpts, true);
      loopRef.current = loop;

      timerRef.current = setTimeout(() => {
        stop();
        if (aliveRef.current) runGame();
      }, DEMO_RESET_MS);

      await loop.start(bots);
    }

    runGame();

    return () => {
      aliveRef.current = false;
      stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1:1 rendering — canvas buffer is (arenaW + padding*2) × (arenaH + padding*2).
  // Negative margins clip the padding so only the arena itself is visible.
  const marginLeft = -CANVAS_PADDING;
  const marginTop  = -CANVAS_PADDING;

  return (
    <div style={{ width: DISPLAY_W, height: DISPLAY_H, overflow: "hidden", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", marginLeft, marginTop }}
      />
    </div>
  );
}
