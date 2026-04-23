import { useEffect, useRef } from "react";
import { GameLoop } from "../game/GameLoop.js";
import { BUILT_IN_BOTS } from "../bots/index.js";

const DEMO_BOTS = [
  { ...BUILT_IN_BOTS[0]!.entry, id: "demo-0" },
  { ...BUILT_IN_BOTS[1]!.entry, id: "demo-1" },
  { ...BUILT_IN_BOTS[2]!.entry, id: "demo-2" },
];

export function SplashCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef  = useRef<GameLoop | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function runGame() {
      if (!aliveRef.current || !canvasRef.current) return;
      const loop = new GameLoop(canvasRef.current, DEMO_BOTS, () => {
        // auto-restart after a short pause
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
