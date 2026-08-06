import type { Session } from "@artemis/shared";
import { API_BASE } from "./config";

export async function listSessions(interviewerId?: string): Promise<Session[]> {
  const q = interviewerId ? `?interviewerId=${encodeURIComponent(interviewerId)}` : "";
  const res = await fetch(`${API_BASE}/sessions${q}`);
  if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
  const data = await res.json();
  return data.sessions as Session[];
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(`Session not found`);
  const data = await res.json();
  return data.session as Session;
}

export async function deleteSession(id: string, interviewerId?: string): Promise<void> {
  const q = interviewerId ? `?interviewerId=${encodeURIComponent(interviewerId)}` : "";
  const res = await fetch(`${API_BASE}/sessions/${id}${q}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed`);
}
