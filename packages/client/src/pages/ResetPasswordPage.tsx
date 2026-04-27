import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "../api/auth.js";

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 12 characters",  test: (pw) => pw.length >= 12 },
  { label: "One uppercase letter",    test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter",    test: (pw) => /[a-z]/.test(pw) },
  { label: "One number",              test: (pw) => /[0-9]/.test(pw) },
];

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const allRulesMet = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet) { setError("Please meet all password requirements."); return; }
    if (!token) { setError("Invalid or expired reset link."); return; }
    setError("");
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const showRules = pwFocused || password.length > 0;

  if (!token) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Invalid link</h1>
          <p style={descStyle}>This reset link is missing or invalid. Please request a new one.</p>
          <Link to="/forgot-password" style={{ ...linkStyle, textAlign: "center" as const }}>Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>New password</h1>

        {done ? (
          <p style={descStyle}>Password updated! Redirecting to sign in…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />

            {showRules && (
              <ul style={rulesListStyle}>
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li key={rule.label} style={{ color: met ? "#5aae6a" : "#666", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "10px" }}>{met ? "✓" : "○"}</span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}

            {error && <p style={errorStyle}>{error}</p>}

            <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        <p style={footerStyle}>
          <Link to="/" style={linkStyle}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-bg)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "40px 36px",
  width: "100%",
  maxWidth: "360px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "22px",
  color: "var(--color-text)",
  textAlign: "center",
};

const descStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: "14px",
  color: "var(--color-text-muted)",
  lineHeight: 1.6,
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg-input)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  fontFamily: "var(--font-ui)",
  fontSize: "14px",
  padding: "10px 12px",
  outline: "none",
  transition: "border-color var(--transition)",
};

const rulesListStyle: React.CSSProperties = {
  margin: "0",
  padding: "0 0 0 4px",
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--color-error)",
  fontSize: "13px",
  fontFamily: "var(--font-mono)",
};

const primaryBtnStyle = (busy: boolean): React.CSSProperties => ({
  background: busy ? "var(--color-text-dim)" : "var(--color-accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "11px",
  fontFamily: "var(--font-mono)",
  fontSize: "14px",
  cursor: busy ? "default" : "pointer",
  transition: "background var(--transition)",
});

const footerStyle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontFamily: "var(--font-ui)",
  fontSize: "13px",
  color: "var(--color-text-muted)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--color-accent-hover)",
  textDecoration: "none",
};
