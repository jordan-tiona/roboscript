const SPEED_STEPS: { label: string; value: number }[] = [
  { label: "1×",    value: 1      },
  { label: "½×",    value: 0.5    },
  { label: "¼×",    value: 0.25   },
  { label: "⅛×",    value: 0.125  },
  { label: "1/16×", value: 0.0625 },
];

interface Props {
  running: boolean;
  canStart?: boolean;
  speed: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSpeedChange: (fraction: number) => void;
}

const btn: React.CSSProperties = {
  padding: "6px 18px",
  background: "#1e1e3e",
  color: "#ccc",
  border: "1px solid #3a3a6e",
  borderRadius: "3px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "13px",
};

const speedBtn = (active: boolean): React.CSSProperties => ({
  padding: "3px 7px",
  background: active ? "#2a2a5e" : "#1e1e3e",
  color: active ? "#aac" : "#555",
  border: `1px solid ${active ? "#5a5aae" : "#2a2a4e"}`,
  borderRadius: "3px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "11px",
});

export function Controls({ running, canStart = true, speed, onStart, onStop, onReset, onSpeedChange }: Props) {
  const startDisabled = !running && !canStart;
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        padding: "8px 12px",
        background: "#0d0d1a",
        borderTop: "1px solid #2a2a4e",
        alignItems: "center",
      }}
    >
      <button
        style={{ ...btn, opacity: startDisabled ? 0.4 : 1 }}
        onClick={running ? onStop : onStart}
        disabled={startDisabled}
        title={startDisabled ? "Need at least 2 bots to start" : undefined}
      >
        {running ? "■ Stop" : "▶ Start"}
      </button>
      <button style={{ ...btn, opacity: running ? 0.5 : 1 }} onClick={onReset} disabled={running}>
        ↺ Reset
      </button>
      <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace", marginLeft: "auto" }}>
        {running ? "battle in progress" : "ready"}
      </span>
      <div style={{ display: "flex", gap: "3px", marginLeft: "12px" }}>
        {SPEED_STEPS.map(({ label, value }) => (
          <button key={value} style={speedBtn(speed === value)} onClick={() => onSpeedChange(value)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
