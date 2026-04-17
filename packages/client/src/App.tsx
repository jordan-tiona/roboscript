import { useRef, useState, useCallback } from "react";
import { Editor } from "./ui/Editor.js";
import { Arena } from "./ui/Arena.js";
import type { ArenaHandle } from "./ui/Arena.js";
import { Controls } from "./ui/Controls.js";
import { BuiltinPicker } from "./ui/BuiltinPicker.js";
import { LogPanel } from "./ui/LogPanel.js";
import type { LogEntry } from "./ui/LogPanel.js";
import { GameLoop } from "./game/GameLoop.js";
import type { BotEntry } from "./game/GameDriver.js";
import { BUILT_IN_BOTS } from "./bots/index.js";
import DEFAULT_BOT_CODE from "./bots/code/default.js?raw";

interface BotSlot {
  id: string;
  mode: "custom" | "builtin";
  customCode: string;
  customName: string;
  builtinId: string | null;
}

function slotLabel(slot: BotSlot): string {
  if (slot.mode === "custom") return slot.customName || "Custom";
  return BUILT_IN_BOTS.find((b) => b.id === slot.builtinId)?.name ?? "—";
}

const INITIAL_SLOTS: BotSlot[] = [
  { id: "slot-1", mode: "custom",  customCode: DEFAULT_BOT_CODE, customName: "MyRobot", builtinId: null },
  { id: "slot-2", mode: "builtin", customCode: DEFAULT_BOT_CODE, customName: "Bot 2",   builtinId: "tracker" },
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  fontFamily: "monospace",
  fontSize: "12px",
  cursor: "pointer",
  background: "transparent",
  color: active ? "#ccc" : "#555",
  border: "none",
  borderBottom: `2px solid ${active ? "#5a5aae" : "transparent"}`,
  whiteSpace: "nowrap",
});

const modeBtn = (active: boolean): React.CSSProperties => ({
  padding: "3px 8px",
  fontFamily: "monospace",
  fontSize: "11px",
  cursor: "pointer",
  border: "1px solid",
  borderRadius: "3px",
  borderColor: active ? "#5a5aae" : "#2a2a4e",
  background: active ? "#1e1e4e" : "transparent",
  color: active ? "#ccc" : "#444",
});

export function App() {
  const [slots, setSlots] = useState<BotSlot[]>(INITIAL_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState(INITIAL_SLOTS[0]!.id);
  const [running, setRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const arenaRef = useRef<ArenaHandle>(null);
  const loopRef = useRef<GameLoop | null>(null);

  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? slots[0]!;

  const updateSlot = useCallback((id: string, patch: Partial<BotSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addSlot = useCallback(() => {
    const id = `slot-${Date.now()}`;
    setSlots((prev) => [
      ...prev,
      { id, mode: "custom", customCode: DEFAULT_BOT_CODE, customName: `Bot ${prev.length + 1}`, builtinId: null },
    ]);
    setActiveSlotId(id);
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveSlotId((cur) => (cur === id ? (next[0]?.id ?? "") : cur));
      return next;
    });
  }, []);

  const handleLog = useCallback((botName: string, message: string, tick: number) => {
    setLogs((prev) => {
      const entry: LogEntry = { id: logIdRef.current++, botName, message, tick };
      return prev.length >= 500 ? [...prev.slice(1), entry] : [...prev, entry];
    });
  }, []);

  const handleStop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    setRunning(false);
  }, []);

  const handleStart = useCallback(() => {
    const canvas = arenaRef.current?.getCanvas();
    if (!canvas) return;

    const bots: BotEntry[] = slots.flatMap((slot) => {
      if (slot.mode === "custom") {
        return [{ id: `bot-${slot.id}`, name: slot.customName || "Bot", code: slot.customCode }];
      }
      const builtin = BUILT_IN_BOTS.find((b) => b.id === slot.builtinId);
      return builtin ? [builtin.entry] : [];
    });

    if (bots.length < 2) return;

    const loop = new GameLoop(canvas, bots, handleStop, handleLog);
    loop.start(bots).then(() => {
      loopRef.current = loop;
      setRunning(true);
    });
  }, [slots, handleStop]);

  const handleReset = useCallback(() => {
    handleStop();
    setLogs([]);
    setResetKey((k) => k + 1);
  }, [handleStop]);

  const validBotCount = slots.filter((s) => s.mode === "custom" || s.builtinId !== null).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0d1a", color: "#eee" }}>
      {/* Left panel */}
      <div style={{ width: "420px", minWidth: "320px", display: "flex", flexDirection: "column", borderRight: "1px solid #2a2a4e" }}>

        {/* Tab strip */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #2a2a4e", background: "#0a0a18", overflowX: "auto" }}>
          {slots.map((slot) => (
            <button key={slot.id} onClick={() => setActiveSlotId(slot.id)} style={tabStyle(slot.id === activeSlotId)}>
              {slotLabel(slot)}
            </button>
          ))}
          {slots.length < 6 && !running && (
            <button onClick={addSlot} style={{ ...tabStyle(false), marginLeft: "auto", padding: "6px 10px" }} title="Add bot slot">
              +
            </button>
          )}
        </div>

        {/* Slot header */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderBottom: "1px solid #2a2a4e" }}>
          {activeSlot.mode === "custom" ? (
            <input
              value={activeSlot.customName}
              onChange={(e) => updateSlot(activeSlot.id, { customName: e.target.value })}
              disabled={running}
              placeholder="Bot name"
              style={{ flex: 1, background: "transparent", border: "none", color: "#aaa", fontFamily: "monospace", fontSize: "12px", outline: "none" }}
            />
          ) : (
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: "12px", color: "#555" }}>
              {BUILT_IN_BOTS.find((b) => b.id === activeSlot.builtinId)?.name ?? "select a bot below"}
            </span>
          )}

          {(["custom", "builtin"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => !running && updateSlot(activeSlot.id, { mode })}
              disabled={running}
              style={{ ...modeBtn(activeSlot.mode === mode), cursor: running ? "default" : "pointer" }}
            >
              {mode}
            </button>
          ))}

          {slots.length > 2 && !running && (
            <button
              onClick={() => removeSlot(activeSlot.id)}
              title="Remove slot"
              style={{ background: "transparent", border: "none", color: "#444", cursor: "pointer", fontFamily: "monospace", fontSize: "14px", padding: "2px 4px", lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Editor or built-in picker */}
        {activeSlot.mode === "custom" ? (
          <Editor
            key={`${activeSlot.id}-${resetKey}`}
            initialCode={activeSlot.customCode}
            onChange={(code) => updateSlot(activeSlot.id, { customCode: code })}
          />
        ) : (
          <BuiltinPicker
            selected={activeSlot.builtinId}
            onChange={(id) => updateSlot(activeSlot.id, { builtinId: id })}
            disabled={running}
          />
        )}

        <Controls
          running={running}
          canStart={validBotCount >= 2}
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
        />
      </div>

      {/* Right panel: arena + log */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "16px", overflow: "hidden" }}>
        <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#555" }}>
          RoboScript — JS Battle Arena
        </div>
        <Arena ref={arenaRef} />
        <LogPanel entries={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );
}
