const BASE = "/api/ladder";

export interface LadderEntry {
  id: string;
  userId: string;
  userName: string;
  botSaveId: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface LadderMyEntry extends LadderEntry {
  matchesToday: number;
  dailyLimit: number;
  lastMatchAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LadderMatch {
  id: string;
  entryAId: string;
  entryBId: string;
  winnerId: string | null;
  ratingDelta: number;
  durationTicks: number;
  createdAt: string;
  permanent: boolean;
}

export interface LadderMatchWithReplay extends LadderMatch {
  replay: unknown;
}

export interface ChallengeResult {
  matchId: string;
  won: boolean;
  draw: boolean;
  ratingChange: number;
  durationTicks: number;
  opponentName: string;
}

export async function getLadder(): Promise<LadderEntry[]> {
  const res = await fetch(BASE, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

export async function getMyLadderEntry(): Promise<LadderMyEntry | null> {
  const res = await fetch(`${BASE}/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load entry");
  return res.json();
}

export async function enterLadder(botSaveId: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/enter`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botSaveId }),
  });
  if (!res.ok) throw new Error("Failed to enter ladder");
  return res.json();
}

export async function getMyMatches(limit = 20, offset = 0): Promise<LadderMatch[]> {
  const res = await fetch(`${BASE}/matches?limit=${limit}&offset=${offset}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load matches");
  return res.json();
}

export async function getMatch(id: string): Promise<LadderMatchWithReplay> {
  const res = await fetch(`${BASE}/matches/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Match not found");
  return res.json();
}

export async function challenge(): Promise<ChallengeResult> {
  const res = await fetch(`${BASE}/challenge`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Challenge failed");
  }
  return res.json();
}
