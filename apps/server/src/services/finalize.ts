import type { RuntimeSession } from "./sessionStore.js";
import { getMemorySession, log, patchSession } from "./sessionStore.js";
import { persistSession, updateSessionFields } from "./supabase.js";
import { scoreTranscript } from "./scoring.js";
import type { DeepgramSession } from "./deepgram.js";
import type { WsServerMessage } from "@artemis/shared";

type SendFn = (msg: WsServerMessage) => void;

const deepgramBySession = new Map<string, DeepgramSession>();

export function registerDeepgram(sessionId: string, dg: DeepgramSession): void {
  deepgramBySession.set(sessionId, dg);
}

export function getDeepgram(sessionId: string): DeepgramSession | undefined {
  return deepgramBySession.get(sessionId);
}

export function unregisterDeepgram(sessionId: string): void {
  deepgramBySession.delete(sessionId);
}

/** Idempotent finalize: scoring once, persist, notify. */
export async function finalizeSession(sessionId: string, send?: SendFn): Promise<RuntimeSession | undefined> {
  const session = getMemorySession(sessionId);
  if (!session) return undefined;

  if (session.status === "ready" && session.scoring) {
    send?.({ type: "result", sessionId, scoring: session.scoring });
    return session;
  }
  if (session.finalizeStarted && session.status === "scoring") {
    log(sessionId, "finalize_already_in_progress");
    return session;
  }

  patchSession(sessionId, {
    finalizeStarted: true,
    status: "scoring",
    ended_at: session.ended_at ?? new Date().toISOString(),
  });
  send?.({ type: "status", sessionId, status: "scoring", message: "Generating HR score…" });

  const dg = getDeepgram(sessionId);
  if (dg) {
    await dg.finish();
    unregisterDeepgram(sessionId);
  }

  try {
    const fresh = getMemorySession(sessionId)!;
    const scoring = await scoreTranscript(sessionId, fresh.transcript);
    const updated = patchSession(sessionId, {
      status: "ready",
      scoring,
      error_message: null,
    })!;
    try {
      await persistSession(updated);
      await updateSessionFields(sessionId, {
        status: "ready",
        transcript: updated.transcript,
        scoring,
        ended_at: updated.ended_at ?? null,
      });
    } catch (persistErr) {
      log(sessionId, "persist_after_score_failed", {
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }
    send?.({ type: "result", sessionId, scoring });
    send?.({ type: "status", sessionId, status: "ready" });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = patchSession(sessionId, {
      status: "failed",
      error_message: message,
    })!;
    await persistSession(failed).catch(() => undefined);
    send?.({ type: "error", sessionId, message });
    send?.({ type: "status", sessionId, status: "failed", message });
    return failed;
  }
}
