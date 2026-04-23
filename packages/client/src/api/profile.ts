export interface UserProfile {
  id: string;
  name: string;
  email: string;
  challengeIndex: number;
}

export async function getProfile(): Promise<UserProfile> {
  const res = await fetch("/api/profile", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export async function resetTutorial(): Promise<void> {
  const res = await fetch("/api/profile/reset-tutorial", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to reset tutorial");
}
