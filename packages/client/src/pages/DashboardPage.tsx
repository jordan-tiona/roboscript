import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsDrawer } from "../ui/SettingsDrawer.js";
import { DocsPanel } from "../ui/DocsPanel.js";
import { ChallengeIntro } from "../ui/ChallengeIntro.js";
import { SavesPanel } from "../ui/SavesPanel.js";
import { LadderPanel } from "../ui/LadderPanel.js";
import { BattleConfig, EXAMPLE_BOTS } from "../ui/BattleConfig.js";
import { Editor } from "../ui/Editor.js";
import { Arena } from "../ui/Arena.js";
import type { ArenaHandle } from "../ui/Arena.js";
import { Controls } from "../ui/Controls.js";
import { LogPanel } from "../ui/LogPanel.js";
import type { LogEntry } from "../ui/LogPanel.js";
import { GameLoop } from "../game/GameLoop.js";
import type { BotEntry } from "../game/GameDriver.js";
import { useAuth } from "../context/AuthContext.js";
import { getProfile, advanceChallenge } from "../api/profile.js";
import { CHALLENGES, CHALLENGE_COUNT } from "../tutorial/challenges.js";
import DEFAULT_BOT_CODE from "../bots/code/default.js?raw";

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [docsOpen, setDocsOpen]           = useState(false);
  const [introOpen, setIntroOpen]         = useState(false);
  const [savesOpen, setSavesOpen]         = useState(false);
  const [ladderOpen, setLadderOpen]       = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem("editorPanelWidth");
    return saved ? Math.max(280, Math.min(700, Number(saved))) : 420;
  });

  // ── Tutorial state ──────────────────────────────────────────────────────────
  const [challengeIndex, setChallengeIndex] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setChallengeIndex(p.challengeIndex);
        if (p.challengeIndex < CHALLENGE_COUNT) setIntroOpen(true);
      })
      .catch(() => setChallengeIndex(CHALLENGE_COUNT));
  }, []);

  const inTutorial = challengeIndex !== null && challengeIndex < CHALLENGE_COUNT;
  const currentChallenge = inTutorial ? CHALLENGES[challengeIndex!]! : null;

  // ── Bot/editor state ────────────────────────────────────────────────────────
  const [playerCode, setPlayerCode] = useState(() => localStorage.getItem("playerCode") ?? DEFAULT_BOT_CODE);
  const [playerName, setPlayerName] = useState("MyRobot");
  const [running, setRunning]       = useState(false);
  const [resetKey, setResetKey]     = useState(0);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const logIdRef    = useRef(0);
  const arenaRef    = useRef<ArenaHandle>(null);
  const loopRef     = useRef<GameLoop | null>(null);
  const playerIdRef = useRef("bot-player");

  // ── Free-play battle config ─────────────────────────────────────────────────
  const [selectedOpponents, setSelectedOpponents] = useState<Set<string>>(
    () => new Set([EXAMPLE_BOTS[0]!.id])
  );
  const [freePlayObstacles, setFreePlayObstacles] = useState(false);

  // ── Resizable divider ───────────────────────────────────────────────────────
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, width: 0 });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, width: panelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPanelWidth(Math.max(280, Math.min(700, dragStart.current.width + ev.clientX - dragStart.current.x)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setPanelWidth(w => { localStorage.setItem("editorPanelWidth", String(w)); return w; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  useEffect(() => {
    const prevent = (e: MouseEvent) => { if (dragging.current) e.preventDefault(); };
    window.addEventListener("selectstart", prevent as EventListener);
    return () => window.removeEventListener("selectstart", prevent as EventListener);
  }, []);

  // ── Game callbacks ──────────────────────────────────────────────────────────
  const handleLog = useCallback((botName: string, message: string, tick: number) => {
    setLogs((prev) => {
      const entry: LogEntry = { id: logIdRef.current++, botName, message, tick };
      return prev.length >= 500 ? [...prev.slice(1), entry] : [...prev, entry];
    });
  }, []);

  const handleGameOver = useCallback((winnerId: string | null) => {
    setRunning(false);
    loopRef.current = null;

    if (currentChallenge && winnerId === playerIdRef.current) {
      advanceChallenge().then((next) => {
        setChallengeIndex(next);
        if (next < CHALLENGE_COUNT) setIntroOpen(true);
      }).catch(console.error);
    }
  }, [currentChallenge]);

  const handleStop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    setRunning(false);
  }, []);

  const handleStart = useCallback(() => {
    const canvas = arenaRef.current?.getCanvas();
    if (!canvas) return;

    const playerBot: BotEntry = { id: playerIdRef.current, name: playerName || "MyRobot", code: playerCode };

    let bots: BotEntry[];
    let arenaOptions = undefined;

    if (currentChallenge) {
      bots = [playerBot, currentChallenge.opponent, ...(currentChallenge.extraOpponents ?? [])];
      arenaOptions = currentChallenge.withObstacles ? undefined : { obstacles: false };
    } else {
      const opponents = EXAMPLE_BOTS.filter((b) => selectedOpponents.has(b.id));
      if (opponents.length === 0) return;
      bots = [playerBot, ...opponents];
      arenaOptions = freePlayObstacles ? undefined : { obstacles: false };
    }

    const loop = new GameLoop(canvas, bots, handleGameOver, handleLog, arenaOptions);
    loopRef.current = loop;
    setRunning(true);
    loop.start(bots).catch(() => {
      loopRef.current = null;
      setRunning(false);
    });
  }, [playerCode, playerName, currentChallenge, selectedOpponents, freePlayObstacles, handleGameOver, handleLog]);

  const handleReset = useCallback(() => {
    handleStop();
    setLogs([]);
    setResetKey((k) => k + 1);
  }, [handleStop]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleLoadSave = useCallback((name: string, code: string) => {
    setPlayerName(name);
    setPlayerCode(code);
    localStorage.setItem("playerCode", code);
    setResetKey((k) => k + 1);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0d1a", color: "#eee" }}>

      {/* Left panel — editor */}
      <div style={{ width: panelWidth, minWidth: 280, maxWidth: 700, display: "flex", flexDirection: "column", flexShrink: 0, position: "relative" }}>

        {/* Tab / name row */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #2a2a4e", background: "#0a0a18" }}>
          <div style={tabStyle(true)}>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={running}
              placeholder="Bot name"
              style={{ background: "transparent", border: "none", color: "inherit", fontFamily: "monospace", fontSize: "12px", outline: "none", width: "100px" }}
            />
          </div>
          {inTutorial && currentChallenge && (
            <span style={{ marginLeft: "auto", padding: "0 10px", fontFamily: "monospace", fontSize: "11px", color: "#444" }}>
              vs {currentChallenge.opponent.name}
              {currentChallenge.extraOpponents?.map(e => ` + ${e.name}`)}
            </span>
          )}
          {!inTutorial && (
            <button
              onClick={() => setSavesOpen(true)}
              disabled={running}
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#444", fontFamily: "monospace", fontSize: "11px", padding: "0 10px", cursor: "pointer" }}
            >
              saves
            </button>
          )}
        </div>

        <Editor
          key={resetKey}
          initialCode={playerCode}
          onChange={(code) => { setPlayerCode(code); localStorage.setItem("playerCode", code); }}
        />

        <Controls
          running={running}
          canStart={!inTutorial ? selectedOpponents.size > 0 : true}
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
        />

        <SavesPanel
          open={savesOpen}
          onClose={() => setSavesOpen(false)}
          currentName={playerName}
          currentCode={playerCode}
          onLoad={handleLoadSave}
        />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{ width: 5, cursor: "col-resize", flexShrink: 0, background: "#2a2a4e", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#5a5aae")}
        onMouseLeave={e => (e.currentTarget.style.background = "#2a2a4e")}
      />

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", padding: "16px", overflow: "hidden", minHeight: 0, position: "relative" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontFamily: "monospace", fontSize: "13px", color: "#555", flexShrink: 0 }}>
          <span>RoboScript</span>
          {inTutorial && challengeIndex !== null && (
            <span style={{ color: "#444" }}>— Challenge {challengeIndex + 1} / {CHALLENGE_COUNT}</span>
          )}
          {!inTutorial && challengeIndex !== null && (
            <span style={{ color: "#444" }}>— Free play</span>
          )}
          {inTutorial && (
            <button
              onClick={() => setIntroOpen(true)}
              title="Show challenge intro"
              style={{ background: "transparent", border: "1px solid #2a2a4e", borderRadius: "3px", color: "#555", fontFamily: "monospace", fontSize: "11px", padding: "2px 7px", cursor: "pointer" }}
            >
              ?
            </button>
          )}
          {user && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => setLadderOpen(o => !o)}
                style={{ background: "transparent", border: "1px solid #2a2a4e", borderRadius: "3px", color: ladderOpen ? "#9090e0" : "#555", fontFamily: "monospace", fontSize: "11px", padding: "2px 8px", cursor: "pointer" }}
              >
                ladder
              </button>
              <button
                onClick={() => setDocsOpen(o => !o)}
                style={{ background: "transparent", border: "1px solid #2a2a4e", borderRadius: "3px", color: docsOpen ? "#9090e0" : "#555", fontFamily: "monospace", fontSize: "11px", padding: "2px 8px", cursor: "pointer" }}
              >
                docs
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                style={{ background: "transparent", border: "none", color: "#666", fontFamily: "monospace", fontSize: "12px", cursor: "pointer", padding: 0 }}
              >
                {user.name}
              </button>
              <button
                onClick={handleSignOut}
                style={{ background: "transparent", border: "1px solid #2a2a4e", borderRadius: "3px", color: "#555", fontFamily: "monospace", fontSize: "11px", padding: "2px 8px", cursor: "pointer" }}
              >
                sign out
              </button>
            </span>
          )}
        </div>

        {/* Free-play config — shown when not in tutorial and not running */}
        {!inTutorial && !running && challengeIndex !== null && (
          <div style={{ flexShrink: 0, padding: "12px 16px", background: "#0a0a18", borderRadius: "4px", border: "1px solid #1a1a3e" }}>
            <BattleConfig
              selected={selectedOpponents}
              onChange={setSelectedOpponents}
              withObstacles={freePlayObstacles}
              onObstaclesChange={setFreePlayObstacles}
            />
          </div>
        )}

        {/* Arena */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
          <Arena ref={arenaRef} />
        </div>

        <LogPanel entries={logs} onClear={() => setLogs([])} />

        {/* Overlays */}
        <DocsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <LadderPanel open={ladderOpen} onClose={() => setLadderOpen(false)} />
        {currentChallenge && (
          <ChallengeIntro
            key={currentChallenge.index}
            challenge={currentChallenge}
            open={introOpen}
            onClose={() => setIntroOpen(false)}
            onStart={() => setIntroOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
