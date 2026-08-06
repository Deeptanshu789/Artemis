import type { RuntimeSession } from "./sessionStore.js";
import { getMemorySession, log } from "./sessionStore.js";
import { persistSession } from "./supabase.js";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 2500;

/** Debounced upsert so live transcripts survive server restart when Supabase is configured. */
export function scheduleTranscriptPersist(sessionId: string): void {
  const prev = timers.get(sessionId);
  if (prev) clearTimeout(prev);
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId);
      const session = getMemorySession(sessionId);
      if (!session) return;
      void persistSession(session).catch((err) =>
        log(sessionId, "live_persist_error", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, DEBOUNCE_MS),
  );
}

export function flushPersist(sessionId: string): Promise<void> {
  const prev = timers.get(sessionId);
  if (prev) clearTimeout(prev);
  timers.delete(sessionId);
  const session = getMemorySession(sessionId);
  if (!session) return Promise.resolve();
  return persistSession(session).catch((err) => {
    log(sessionId, "flush_persist_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export type { RuntimeSession };
