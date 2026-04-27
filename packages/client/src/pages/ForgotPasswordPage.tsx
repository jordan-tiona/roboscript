import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth.js";

export function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [busy, setBusy]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Reset password</h1>

        {sent ? (
          <p style={infoStyle}>
            If that email is registered, you'll receive a reset link shortly.
            Check your inbox and spam folder.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={descStyle}>Enter your account email and we'll send you a reset link.</p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inputStyle}
            />

            {error && <p style={errorStyle}>{error}</p>}

            <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
              {busy ? "Sending…" : "Send reset link"}
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
  fontSize: "13px",
  color: "var(--color-text-muted)",
};

const infoStyle: React.CSSProperties = {
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
