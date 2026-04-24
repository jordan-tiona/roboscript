import DUMMY_CODE from "../bots/code/tutorial/dummy.js?raw";
import TURRET_CODE from "../bots/code/tutorial/turret.js?raw";
import PREDICTOR_CODE from "../bots/code/tutorial/predictor.js?raw";
import DUELIST_CODE from "../bots/code/tutorial/duelist.js?raw";
import WANDERER_CODE from "../bots/code/tutorial/wanderer.js?raw";
import SPRINTER_CODE from "../bots/code/tutorial/sprinter.js?raw";
import SNIPER_CODE from "../bots/code/tutorial/sniper.js?raw";
import ORBITER_CODE from "../bots/code/orbiter.js?raw";
import type { BotEntry } from "../game/GameDriver.js";

export const EXAMPLE_BOTS: BotEntry[] = [
  { id: "example-dummy",    name: "Dummy",    code: DUMMY_CODE },
  { id: "example-turret",   name: "Turret",   code: TURRET_CODE },
  { id: "example-predictor",name: "Predictor",code: PREDICTOR_CODE },
  { id: "example-duelist",  name: "Duelist",  code: DUELIST_CODE },
  { id: "example-wanderer", name: "Wanderer", code: WANDERER_CODE },
  { id: "example-sprinter", name: "Sprinter", code: SPRINTER_CODE },
  { id: "example-sniper",   name: "Sniper",   code: SNIPER_CODE },
  { id: "example-orbiter",  name: "Orbiter",  code: ORBITER_CODE },
];

interface Props {
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  withObstacles: boolean;
  onObstaclesChange: (v: boolean) => void;
}

const btn = (active: boolean): React.CSSProperties => ({
  background: active ? "#1a1a3e" : "transparent",
  border: `1px solid ${active ? "#5a5aae" : "#2a2a4e"}`,
  borderRadius: "4px",
  color: active ? "#9090e0" : "#555",
  fontFamily: "monospace",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
});

export function BattleConfig({ selected, onChange, withObstacles, onObstaclesChange }: Props) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>
      <div style={{ marginBottom: 12, color: "#555" }}>select opponents</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: 16 }}>
        {EXAMPLE_BOTS.map((b) => (
          <button key={b.id} style={btn(selected.has(b.id))} onClick={() => toggle(b.id)}>
            {b.name}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={withObstacles}
          onChange={(e) => onObstaclesChange(e.target.checked)}
          style={{ accentColor: "#5a5aae" }}
        />
        obstacles
      </label>
    </div>
  );
}
