import { BUILT_IN_BOTS } from "../bots/index.js";

interface Props {
  selected: string | null;
  onChange: (id: string) => void;
  disabled: boolean;
}

export function BuiltinPicker({ selected, onChange, disabled }: Props) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {BUILT_IN_BOTS.map((bot) => {
          const active = selected === bot.id;
          return (
            <button
              key={bot.id}
              onClick={() => !disabled && onChange(bot.id)}
              disabled={disabled}
              style={{
                padding: "10px 12px",
                textAlign: "left",
                background: active ? "#1e1e4e" : "#111128",
                border: `1px solid ${active ? "#5a5aae" : "#2a2a4e"}`,
                borderRadius: "4px",
                color: active ? "#ccc" : "#666",
                cursor: disabled ? "default" : "pointer",
                fontFamily: "monospace",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <div style={{ fontSize: "13px", marginBottom: "3px" }}>
                {active ? "✓ " : ""}{bot.name}
              </div>
              <div style={{ fontSize: "11px", color: active ? "#666" : "#444" }}>
                {bot.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
