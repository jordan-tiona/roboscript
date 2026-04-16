interface Props {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
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

export function Controls({ running, onStart, onStop, onReset }: Props) {
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
      <button style={btn} onClick={running ? onStop : onStart}>
        {running ? "■ Stop" : "▶ Start"}
      </button>
      <button style={{ ...btn, opacity: running ? 0.5 : 1 }} onClick={onReset} disabled={running}>
        ↺ Reset
      </button>
      <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace", marginLeft: "auto" }}>
        {running ? "battle in progress" : "ready"}
      </span>
    </div>
  );
}
