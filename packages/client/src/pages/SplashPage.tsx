import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SplashCanvas } from "../ui/SplashCanvas.js";
import { signIn } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.js";

export function SplashPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SplashCanvas />

      <div style={cardStyle}>
        <h1 style={titleStyle}>RoboScript</h1>
        <p style={subtitleStyle}>JS Battle Arena</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && <p style={errorStyle}>{error}</p>}

          <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={footerStyle}>
          No account?{" "}
          <Link to="/register" style={linkStyle}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "rgba(13,13,26,0.88)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backdropFilter: "blur(6px)",
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
  fontSize: "28px",
  color: "var(--color-text)",
  letterSpacing: "0.04em",
  textAlign: "center",
};

const subtitleStyle: React.CSSProperties = {
  margin: "-16px 0 0",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
  textAlign: "center",
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
