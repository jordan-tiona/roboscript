import type { Challenge } from "../tutorial/challenges.js";
import { CHALLENGE_COUNT } from "../tutorial/challenges.js";
import { TutorialCanvas, DISPLAY_W, DISPLAY_H } from "./TutorialCanvas.js";

interface Props {
  challenge: Challenge;
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function ChallengeIntro({ challenge, open, onClose, onStart }: Props) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      zIndex: 20,
      background: "var(--color-bg)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
      transition: "opacity 0.2s ease",
      padding: "24px",
      overflow: "auto",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        maxWidth: `${DISPLAY_W + 40}px`,
      }}>
        {/* Progress + close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={labelStyle}>
            Challenge {challenge.index + 1} / {CHALLENGE_COUNT}
          </span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Title */}
        <h2 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "22px", color: "var(--color-text)" }}>
          {challenge.title}
        </h2>

        {/* Blurb */}
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: "14px", color: "#aaa", lineHeight: 1.7 }}>
          {challenge.blurb}
        </p>

        {/* Demo animation */}
        <TutorialCanvas
          player={challenge.demo.player}
          opponent={challenge.demo.opponent}
          extraOpponents={challenge.demo.extraOpponents ?? []}
          withObstacles={challenge.withObstacles ?? false}
        />

        {/* Code snippet */}
        <div>
          <p style={{ margin: "0 0 8px", fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Hint
          </p>
          <pre style={snippetStyle}>{challenge.snippet}</pre>
        </div>

        {/* CTA */}
        <button onClick={onStart} style={startBtnStyle}>
          Start challenge →
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: "16px",
  padding: "2px 6px",
  lineHeight: 1,
};

const snippetStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  background: "#08081a",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "#aaa",
  lineHeight: 1.7,
  overflowX: "auto",
  whiteSpace: "pre",
};

const startBtnStyle: React.CSSProperties = {
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "12px",
  fontFamily: "var(--font-mono)",
  fontSize: "14px",
  cursor: "pointer",
  width: "100%",
};
