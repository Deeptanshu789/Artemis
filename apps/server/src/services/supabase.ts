import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Session, ScoringResult, TranscriptSegment } from "@artemis/shared";
import { env } from "../config.js";
import { log } from "./sessionStore.js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export async function persistSession(session: Session): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    log(session.id, "persist_skip_no_supabase");
    return;
  }
  const row = {
    id: session.id,
    interviewer_id: session.interviewer_id,
    interviewer_name: session.interviewer_name ?? null,
    candidate_label: session.candidate_label ?? null,
    status: session.status,
    platform: session.platform ?? "google_meet",
    transcript: session.transcript,
    scoring: session.scoring ?? null,
    error_message: session.error_message ?? null,
    started_at: session.started_at,
    ended_at: session.ended_at ?? null,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
  const { error } = await sb.from("sessions").upsert(row, { onConflict: "id" });
  if (error) {
    log(session.id, "persist_error", { error: error.message });
    throw new Error(error.message);
  }
}

export async function fetchSessions(interviewerId?: string): Promise<Session[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    let q = sb.from("sessions").select("*").order("started_at", { ascending: false });
    if (interviewerId) q = q.eq("interviewer_id", interviewerId);
    const { data, error } = await q;
    if (error) {
      log(undefined, "fetch_sessions_error", { error: error.message });
      return [];
    }
    return (data ?? []) as Session[];
  } catch (err) {
    log(undefined, "fetch_sessions_throw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function fetchSession(id: string): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
    if (error) {
      log(id, "fetch_session_error", { error: error.message });
      return null;
    }
    return (data as Session) ?? null;
  } catch (err) {
    log(id, "fetch_session_throw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function deleteSessionRow(id: string, interviewerId?: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  let q = sb.from("sessions").delete().eq("id", id);
  if (interviewerId) q = q.eq("interviewer_id", interviewerId);
  const { error, count } = await q.select("id");
  if (error) throw error;
  return Array.isArray(count) ? count.length > 0 : true;
}

export async function updateSessionFields(
  id: string,
  fields: Partial<{
    status: string;
    transcript: TranscriptSegment[];
    scoring: ScoringResult | null;
    error_message: string | null;
    ended_at: string | null;
    interviewer_name: string | null;
  }>,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("sessions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    log(id, "update_error", { error: error.message });
    throw error;
  }
}
