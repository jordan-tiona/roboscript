import { useEffect, useRef } from "react";

export interface LogEntry {
  id: number;
  botName: string;
  message: string;
  tick: number;
  type?: "log" | "error";
}

interface Props {
  entries: LogEntry[];
  onClear: () => void;
}

export function LogPanel({ entries, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [entries.length]);

  return (
    <div style={{ width: "100%", height: "160px", display: "flex", flexDirection: "column", border: "1px solid #2a2a4e", borderRadius: "3px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "3px 8px", borderBottom: "1px solid #2a2a4e", background: "#0a0a18" }}>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#555", flex: 1 }}>console</span>
        <button
          onClick={onClear}
          style={{ background: "transparent", border: "none", color: "#444", cursor: "pointer", fontFamily: "monospace", fontSize: "11px", padding: "0 4px" }}
        >
          clear
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 8px", background: "#080814" }}>
        {entries.length === 0 ? (
          <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#333", paddingTop: "2px" }}>
            use console.log() in your bot to debug
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} style={{ fontFamily: "monospace", fontSize: "11px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              <span style={{ color: "#444" }}>[{e.tick}]</span>
              <span style={{ color: e.type === "error" ? "#ae5a5a" : "#5a5aae" }}> {e.botName}:</span>
              <span style={{ color: e.type === "error" ? "#e07070" : "#aaa" }}> {e.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
