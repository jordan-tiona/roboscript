export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const res = await post("/api/auth/sign-in/email", { email, password });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Sign in failed");
  }
  const data = await res.json();
  return data.user as SessionUser;
}

export async function signUp(name: string, email: string, password: string, recaptchaToken: string): Promise<SessionUser> {
  const res = await post("/api/auth/sign-up/email", { name, email, password, recaptchaToken });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Sign up failed");
  }
  const data = await res.json();
  return data.user as SessionUser;
}

export async function signOut(): Promise<void> {
  await post("/api/auth/sign-out", {});
}

export async function getSession(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/get-session", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.user as SessionUser) ?? null;
}

export async function forgotPassword(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const res = await post("/api/auth/request-password-reset", { email, redirectTo });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Request failed");
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await post("/api/auth/reset-password", { token, newPassword });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Reset failed");
  }
}
