import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export const GUEST_ID = "guest";
export const DEMO_TREND_ID = "demo-interviewer-b";

const GUEST_KEY = "artemis_guest";

export function getGuestIdentity(): { id: string; name: string } {
  const raw = localStorage.getItem(GUEST_KEY);
  if (raw) return JSON.parse(raw);
  const identity = { id: GUEST_ID, name: "Guest" };
  localStorage.setItem(GUEST_KEY, JSON.stringify(identity));
  return identity;
}

export function setViewer(id: string, name: string) {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ id, name }));
}
