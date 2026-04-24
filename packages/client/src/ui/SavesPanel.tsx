import { useState, useEffect, useCallback } from "react";
import { listSaves, loadSave, createSave, updateSave, deleteSave } from "../api/bots.js";
import type { BotSave } from "../api/bots.js";

interface Props {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentCode: string;
  onLoad: (name: string, code: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function SavesPanel({ open, onClose, currentName, currentCode, onLoad }: Props) {
  const [saves, setSaves] = useState<BotSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listSaves()
      .then(setSaves)
      .catch(() => setError("Failed to load saves"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const label = `${currentName || "Bot"} — ${formatDate(new Date().toISOString())}`;
      await createSave(label, currentCode);
      refresh();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [currentName, currentCode, refresh]);

  const handleLoad = useCallback(async (id: string) => {
    try {
      const full = await loadSave(id);
      onLoad(full.name.replace(/ — .+$/, ""), full.code);
      onClose();
    } catch {
      setError("Failed to load save");
    }
  }, [onLoad, onClose]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSave(id);
      setSaves((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Failed to delete save");
    }
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "#0a0a18", display: "flex", flexDirection: "column",
      fontFamily: "monospace", fontSize: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #2a2a4e" }}>
        <span style={{ color: "#888", flex: 1 }}>saves</span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: "#1a1a3e", border: "1px solid #3a3a6e", borderRadius: "3px", color: "#9090e0", fontFamily: "monospace", fontSize: "11px", padding: "3px 10px", cursor: "pointer", marginRight: 8 }}
        >
          {saving ? "saving…" : "save current"}
        </button>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "#555", fontFamily: "monospace", fontSize: "14px", cursor: "pointer", padding: "0 4px" }}
        >
          ×
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {loading && <div style={{ padding: "12px", color: "#444" }}>loading…</div>}
        {error && <div style={{ padding: "12px", color: "#c05050" }}>{error}</div>}
        {!loading && saves.length === 0 && (
          <div style={{ padding: "12px", color: "#444" }}>No saves yet.</div>
        )}
        {saves.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #111122" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ color: "#444", fontSize: "10px", marginTop: 2 }}>{formatDate(s.updatedAt)}</div>
            </div>
            <button
              onClick={() => handleLoad(s.id)}
              style={{ background: "transparent", border: "1px solid #2a2a4e", borderRadius: "3px", color: "#666", fontFamily: "monospace", fontSize: "10px", padding: "2px 8px", cursor: "pointer", marginLeft: 8, flexShrink: 0 }}
            >
              load
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              style={{ background: "transparent", border: "none", color: "#3a3a3a", fontFamily: "monospace", fontSize: "12px", padding: "0 4px 0 8px", cursor: "pointer", flexShrink: 0 }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
