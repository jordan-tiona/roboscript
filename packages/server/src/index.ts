import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { botsRouter } from "./routes/bots.js";
import { profileRouter } from "./routes/profile.js";
import { ladderRouter } from "./routes/ladder.js";

const CLIENT_ORIGIN = process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173";
const PORT = parseInt(process.env["PORT"] ?? "8080");

const app = new Hono();

app.use(
  "*",
  cors({
    origin: CLIENT_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// ── Password & reCAPTCHA validation ───────────────────────────────────────────

function validatePasswordStrength(password: string): string | null {
  if (password.length < 12)    return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env["RS_RECAPTCHA_SECRET_KEY"];
  if (!secret) return true; // skip when not configured (dev)
  if (!token)  return false;
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = await res.json() as { success: boolean; score?: number };
  return data.success && (data.score === undefined || data.score >= 0.5);
}

// Intercept registration to verify reCAPTCHA and password strength before
// passing the request to better-auth. We read the raw body text and reconstruct
// the Request so the stream is still available for better-auth to parse.
app.post("/api/auth/sign-up/email", async (c) => {
  const rawBody = await c.req.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return c.json({ message: "Invalid request body" }, 400); }

  const pwError = validatePasswordStrength(typeof body["password"] === "string" ? body["password"] : "");
  if (pwError) return c.json({ message: pwError }, 400);

  const ok = await verifyRecaptcha(typeof body["recaptchaToken"] === "string" ? body["recaptchaToken"] : "");
  if (!ok) return c.json({ message: "reCAPTCHA verification failed. Please try again." }, 400);

  return auth.handler(new Request(c.req.raw.url, { method: "POST", headers: c.req.raw.headers, body: rawBody }));
});

// Intercept password reset to enforce the same strength rules on new passwords.
app.post("/api/auth/reset-password", async (c) => {
  const rawBody = await c.req.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return c.json({ message: "Invalid request body" }, 400); }

  const pwError = validatePasswordStrength(typeof body["newPassword"] === "string" ? body["newPassword"] : "");
  if (pwError) return c.json({ message: pwError }, 400);

  return auth.handler(new Request(c.req.raw.url, { method: "POST", headers: c.req.raw.headers, body: rawBody }));
});

// better-auth owns all remaining /api/auth/* routes
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/bots", botsRouter);
app.route("/api/profile", profileRouter);
app.route("/api/ladder", ladderRouter);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on port ${PORT}`);
});
