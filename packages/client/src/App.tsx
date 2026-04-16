import { useRef, useState, useCallback } from "react";
import { Editor } from "./ui/Editor.js";
import { Arena } from "./ui/Arena.js";
import type { ArenaHandle } from "./ui/Arena.js";
import { Controls } from "./ui/Controls.js";
import { GameLoop } from "./game/GameLoop.js";
import type { BotEntry } from "./game/GameDriver.js";
import { BUILT_IN_BOTS } from "./bots/index.js";
import { DEFAULT_BOT_CODE } from "./bots/default.js";


const opponent = BUILT_IN_BOTS[0]!.entry;

export function App() {
  const [botACode, setBotACode] = useState(DEFAULT_BOT_CODE);
  const [running, setRunning] = useState(false);
  const arenaRef = useRef<ArenaHandle>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const [key, setKey] = useState(0); // forces Editor remount on reset

  const bots = useRef<BotEntry[]>([]);

  const handleStart = useCallback(() => {
    const canvas = arenaRef.current?.getCanvas();
    if (!canvas) return;

    bots.current = [
      { id: "bot-1", name: "MyRobot", code: botACode },
      opponent,
    ];

    const loop = new GameLoop(canvas, bots.current);
    loop.start(bots.current).then(() => {
      loopRef.current = loop;
      setRunning(true);
    });
  }, [botACode]);

  const handleStop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    setRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    handleStop();
    setKey((k) => k + 1); // remount editor to clear any stale state
  }, [handleStop]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0d1a", color: "#eee" }}>
      {/* Left panel: editor + controls */}
      <div
        style={{
          width: "420px",
          minWidth: "320px",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #2a2a4e",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "#0d0d1a",
            borderBottom: "1px solid #2a2a4e",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#888",
          }}
        >
          bot-1 · MyRobot.js
        </div>
        <Editor key={key} initialCode={botACode} onChange={setBotACode} />
        <Controls running={running} onStart={handleStart} onStop={handleStop} onReset={handleReset} />
      </div>

      {/* Right panel: arena */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "16px",
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#555" }}>
          RoboScript — JS Battle Arena
        </div>
        <Arena ref={arenaRef} />
        <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#444" }}>
          opponent: {opponent.name}
        </div>
      </div>
    </div>
  );
}
