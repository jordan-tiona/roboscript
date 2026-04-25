import { useState, useEffect, useCallback } from "react";
import {
  getLadder, getMyLadderEntry, enterLadder, getMyMatches, challenge,
} from "../api/ladder.js";
import type { LadderEntry, LadderMyEntry, LadderMatch, ChallengeResult } from "../api/ladder.js";
import { listSaves } from "../api/bots.js";
import type { BotSave } from "../api/bots.js";

type Tab = "leaderboard" | "entry" | "matches";

interface Props {
  open: boolean;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: "12px" };
const subtle: React.CSSProperties = { ...mono, color: "#555" };

function btnStyle(accent = false, disabled = false): React.CSSProperties {
  return {
    ...mono,
    padding: "5px 12px",
    background: accent ? "#3a3a8e" : "transparent",
    border: `1px solid ${accent ? "#5a5aae" : "#2a2a4e"}`,
    borderRadius: 3,
    color: disabled ? "#444" : accent ? "#ccc" : "#888",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function ratingColor(rating: number): string {
  if (rating >= 1200) return "#ffa726";
  if (rating >= 1100) return "#66bb6a";
  if (rating >= 1000) return "#4fc3f7";
  return "#888";
}

function formatDuration(ticks: number): string {
  const secs = Math.round(ticks / 30);
  return `${secs}s`;
}

export function LadderPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [leaderboard, setLeaderboard] = useState<LadderEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LadderMyEntry | null | undefined>(undefined);
  const [matches, setMatches] = useState<LadderMatch[]>([]);
  const [saves, setSaves] = useState<BotSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setError(null); setChallengeResult(null); return; }
    setLoading(true);
    Promise.all([getLadder(), getMyLadderEntry(), listSaves()])
      .then(([lb, me, sv]) => { setLeaderboard(lb); setMyEntry(me); setSaves(sv); })
      .catch(() => setError("Failed to load ladder"))
      .finally(() => setLoading(false));
  }, [open]);

  const refreshMatches = useCallback(() => {
    setMatchesLoading(true);
    getMyMatches().then(setMatches).catch(console.error).finally(() => setMatchesLoading(false));
  }, []);

  useEffect(() => { if (open && tab === "matches") refreshMatches(); }, [open, tab, refreshMatches]);

  const handleEnter = useCallback(async (botSaveId: string) => {
    setError(null);
    try {
      await enterLadder(botSaveId);
      const me = await getMyLadderEntry();
      setMyEntry(me);
    } catch {
      setError("Failed to update ladder entry");
    }
  }, []);

  const handleChallenge = useCallback(async () => {
    setChallenging(true);
    setChallengeResult(null);
    setError(null);
    try {
      const result = await challenge();
      setChallengeResult(result);
      const [me, lb] = await Promise.all([getMyLadderEntry(), getLadder()]);
      setMyEntry(me);
      setLeaderboard(lb);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setChallenging(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    ...mono,
    padding: "6px 14px",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid ${tab === t ? "#5a5aae" : "transparent"}`,
    color: tab === t ? "#ccc" : "#555",
    cursor: "pointer",
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#0a0a18", border: "1px solid #2a2a4e", borderRadius: 6, width: 600, maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1a1a3e" }}>
          <span style={{ ...mono, fontSize: "14px", color: "#aaa" }}>Ladder</span>
          <button onClick={onClose} style={{ marginLeft: "auto", ...btnStyle() }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a1a3e" }}>
          <button style={tabStyle("leaderboard")} onClick={() => setTab("leaderboard")}>leaderboard</button>
          <button style={tabStyle("entry")} onClick={() => setTab("entry")}>my entry</button>
          <button style={tabStyle("matches")} onClick={() => setTab("matches")}>matches</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {loading && <p style={subtle}>loading…</p>}
          {error && <p style={{ ...mono, color: "#ef5350" }}>{error}</p>}

          {/* Leaderboard tab */}
          {!loading && tab === "leaderboard" && (
            <table style={{ width: "100%", borderCollapse: "collapse", ...mono }}>
              <thead>
                <tr style={{ color: "#444", borderBottom: "1px solid #1a1a3e" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: "normal" }}>#</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: "normal" }}>name</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: "normal" }}>rating</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: "normal" }}>W / L / D</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid #111" }}>
                    <td style={{ padding: "5px 8px", color: "#444" }}>{i + 1}</td>
                    <td style={{ padding: "5px 8px", color: "#ccc" }}>
                      {e.userName}
                      {myEntry?.id === e.id && <span style={{ color: "#5a5aae", marginLeft: 6 }}>← you</span>}
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: ratingColor(e.rating) }}>{e.rating}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: "#666" }}>
                      {e.wins} / {e.losses} / {e.ties}
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && <tr><td colSpan={4} style={{ padding: "16px 8px", color: "#444" }}>No entries yet.</td></tr>}
              </tbody>
            </table>
          )}

          {/* My Entry tab */}
          {!loading && tab === "entry" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {myEntry ? (
                <>
                  <div style={{ ...mono, color: "#888", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px" }}>
                    <span style={{ color: "#444" }}>rating</span>
                    <span style={{ color: ratingColor(myEntry.rating) }}>{myEntry.rating}</span>
                    <span style={{ color: "#444" }}>record</span>
                    <span>{myEntry.wins}W – {myEntry.losses}L – {myEntry.ties}D</span>
                    <span style={{ color: "#444" }}>today</span>
                    <span>{myEntry.matchesToday} / {myEntry.dailyLimit} matches</span>
                  </div>

                  {challengeResult && (
                    <div style={{ ...mono, padding: "10px 14px", background: "#0d0d1a", border: `1px solid ${challengeResult.won ? "#2e7d32" : challengeResult.draw ? "#1a237e" : "#7f0000"}`, borderRadius: 4 }}>
                      <span style={{ color: challengeResult.won ? "#66bb6a" : challengeResult.draw ? "#4fc3f7" : "#ef5350" }}>
                        {challengeResult.won ? "Victory" : challengeResult.draw ? "Draw" : "Defeat"}
                      </span>
                      <span style={{ color: "#555", marginLeft: 12 }}>vs {challengeResult.opponentName}</span>
                      <span style={{ marginLeft: 12, color: challengeResult.ratingChange >= 0 ? "#66bb6a" : "#ef5350" }}>
                        {challengeResult.ratingChange > 0 ? "+" : ""}{challengeResult.ratingChange} rating
                      </span>
                      <span style={{ color: "#444", marginLeft: 12 }}>{formatDuration(challengeResult.durationTicks)}</span>
                    </div>
                  )}

                  <button
                    onClick={handleChallenge}
                    disabled={challenging || myEntry.matchesToday >= myEntry.dailyLimit}
                    style={{ ...btnStyle(true, challenging || myEntry.matchesToday >= myEntry.dailyLimit), alignSelf: "flex-start" }}
                  >
                    {challenging ? "running match…" : "⚔ Challenge"}
                  </button>

                  <div>
                    <p style={{ ...subtle, marginBottom: 8 }}>Change active bot:</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {saves.map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ ...mono, color: myEntry.botSaveId === s.id ? "#ccc" : "#666", flex: 1 }}>
                            {s.name}
                            {myEntry.botSaveId === s.id && <span style={{ color: "#5a5aae", marginLeft: 6 }}>← active</span>}
                          </span>
                          {myEntry.botSaveId !== s.id && (
                            <button onClick={() => handleEnter(s.id)} style={btnStyle()}>use</button>
                          )}
                        </div>
                      ))}
                      {saves.length === 0 && <p style={subtle}>Save a bot first using the saves panel.</p>}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ ...mono, color: "#888" }}>You are not on the ladder yet. Pick a saved bot to enter:</p>
                  {saves.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...mono, color: "#888", flex: 1 }}>{s.name}</span>
                      <button onClick={() => handleEnter(s.id)} style={btnStyle(true)}>Enter with this bot</button>
                    </div>
                  ))}
                  {saves.length === 0 && <p style={subtle}>No saved bots. Save your bot first.</p>}
                </div>
              )}
            </div>
          )}

          {/* Matches tab */}
          {!loading && tab === "matches" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {matchesLoading && <p style={subtle}>loading…</p>}
              {!matchesLoading && matches.map(m => {
                const iWon  = myEntry && m.winnerId === myEntry.id;
                const isDraw = m.winnerId === null;
                return (
                  <div key={m.id} style={{ ...mono, display: "flex", alignItems: "center", gap: 12, padding: "6px 10px", background: "#0d0d1a", borderRadius: 3, border: "1px solid #111" }}>
                    <span style={{ color: iWon ? "#66bb6a" : isDraw ? "#4fc3f7" : "#ef5350", minWidth: 44 }}>
                      {iWon ? "win" : isDraw ? "draw" : "loss"}
                    </span>
                    <span style={{ color: iWon ? "#66bb6a" : isDraw ? "#555" : "#ef5350" }}>
                      {iWon ? `+${m.ratingDelta}` : isDraw ? "±0" : `-${m.ratingDelta}`}
                    </span>
                    <span style={{ color: "#444", flex: 1 }}>{formatDuration(m.durationTicks)}</span>
                    <span style={{ color: "#333" }}>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                );
              })}
              {!matchesLoading && matches.length === 0 && !myEntry && (
                <p style={subtle}>Enter the ladder first to see match history.</p>
              )}
              {!matchesLoading && matches.length === 0 && myEntry && (
                <p style={subtle}>No matches yet. Challenge someone!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
