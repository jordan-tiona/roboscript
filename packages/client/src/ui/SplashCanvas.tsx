import { useEffect, useRef } from "react";
import { GameLoop } from "../game/GameLoop.js";
import duelistCode  from "../bots/code/tutorial/duelist.js?raw";
import wandererCode from "../bots/code/tutorial/wanderer.js?raw";
import sprinterCode from "../bots/code/tutorial/sprinter.js?raw";
import type { BotEntry } from "../game/GameDriver.js";

const DEMO_BOTS: BotEntry[] = [
  { id: "demo-0", name: "Duelist",  code: duelistCode  },
  { id: "demo-1", name: "Wanderer", code: wandererCode },
  { id: "demo-2", name: "Sprinter", code: sprinterCode },
];

export function SplashCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef   = useRef<GameLoop | null>(null);
  const aliveRef  = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function runGame() {
      if (!aliveRef.current || !canvasRef.current) return;
      const loop = new GameLoop(canvasRef.current, DEMO_BOTS, () => {
        if (aliveRef.current) setTimeout(runGame, 2500);
      });
      loopRef.current = loop;
      await loop.start(DEMO_BOTS);
    }

    runGame();

    return () => {
      aliveRef.current = false;
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        opacity: 0.45,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
