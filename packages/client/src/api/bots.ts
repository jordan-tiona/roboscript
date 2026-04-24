export interface BotSave {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotSaveWithCode extends BotSave {
  code: string;
}

export async function listSaves(): Promise<BotSave[]> {
  const res = await fetch("/api/bots", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load saves");
  return res.json();
}

export async function loadSave(id: string): Promise<BotSaveWithCode> {
  const res = await fetch(`/api/bots/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load save");
  return res.json();
}

export async function createSave(name: string, code: string): Promise<string> {
  const res = await fetch("/api/bots", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code }),
  });
  if (!res.ok) throw new Error("Failed to create save");
  const data = await res.json() as { id: string };
  return data.id;
}

export async function updateSave(id: string, name: string, code: string): Promise<void> {
  const res = await fetch(`/api/bots/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code }),
  });
  if (!res.ok) throw new Error("Failed to update save");
}

export async function deleteSave(id: string): Promise<void> {
  const res = await fetch(`/api/bots/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete save");
}
