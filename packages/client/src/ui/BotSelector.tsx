import { BUILT_IN_BOTS } from "../bots/index.js";

interface Props {
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  disabled: boolean;
}

export function BotSelector({ selected, onChange, disabled }: Props) {
  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div
      style={{
        padding: "8px 12px",
        borderTop: "1px solid #2a2a4e",
        background: "#0d0d1a",
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#555", marginBottom: "6px" }}>
        opponents
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {BUILT_IN_BOTS.map((bot) => {
          const active = selected.has(bot.id);
          return (
            <button
              key={bot.id}
              onClick={() => toggle(bot.id)}
              disabled={disabled}
              title={bot.description}
              style={{
                padding: "4px 10px",
                fontFamily: "monospace",
                fontSize: "12px",
                cursor: disabled ? "default" : "pointer",
                border: "1px solid",
                borderRadius: "3px",
                borderColor: active ? "#5a5aae" : "#2a2a4e",
                background: active ? "#1e1e4e" : "#0d0d1a",
                color: active ? "#ccc" : "#444",
                opacity: disabled ? 0.5 : 1,
                transition: "all 0.1s",
              }}
            >
              {active ? "✓ " : ""}{bot.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
