import { useEffect, useRef, useState } from "react";
import { getProfile, resetTutorial, type UserProfile } from "../api/profile.js";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setResetDone(false);
      getProfile().then(setProfile).catch(() => null);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetTutorial();
      setResetDone(true);
      if (profile) setProfile({ ...profile, challengeIndex: 0 });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 99,
        background: "rgba(0,0,0,0.45)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.2s ease",
      }} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "300px",
          zIndex: 100,
          background: "var(--color-bg-card)",
          borderLeft: "1px solid var(--color-border)",
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s ease",
          padding: "24px 20px",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--color-text)" }}>
            Settings
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {profile ? (
          <section style={sectionStyle}>
            <h3 style={sectionHeadingStyle}>Account</h3>
            <p style={fieldStyle}><span style={labelStyle}>Name</span>{profile.name}</p>
            <p style={fieldStyle}><span style={labelStyle}>Email</span>{profile.email}</p>
          </section>
        ) : (
          <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Loading…</p>
        )}

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Tutorial</h3>
          {profile && (
            <p style={fieldStyle}>
              <span style={labelStyle}>Progress</span>
              Challenge {profile.challengeIndex + 1}
            </p>
          )}
          <button
            onClick={handleReset}
            disabled={resetting}
            style={dangerBtnStyle(resetting)}
          >
            {resetting ? "Resetting…" : resetDone ? "Progress reset" : "Restart tutorial progress"}
          </button>
          {resetDone && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
              Tutorial will restart from challenge 1.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: "16px",
  padding: "2px 6px",
  lineHeight: 1,
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  paddingBottom: "6px",
};

const fieldStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  color: "var(--color-text)",
  display: "flex",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  minWidth: "56px",
};

const dangerBtnStyle = (busy: boolean): React.CSSProperties => ({
  background: "transparent",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: busy ? "var(--color-text-muted)" : "#e08a5a",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  padding: "8px 12px",
  cursor: busy ? "default" : "pointer",
  textAlign: "left",
  transition: "border-color 0.15s, color 0.15s",
});
