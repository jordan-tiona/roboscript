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

export async function signUp(name: string, email: string, password: string): Promise<SessionUser> {
  const res = await post("/api/auth/sign-up/email", { name, email, password });
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
