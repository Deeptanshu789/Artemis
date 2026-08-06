import type { Session, SessionStatus, TranscriptSegment, ScoringResult } from "@artemis/shared";

export function log(sessionId: string | undefined, msg: string, extra?: Record<string, unknown>) {
  const base = { ts: new Date().toISOString(), sessionId: sessionId ?? null, msg, ...extra };
  console.log(JSON.stringify(base));
}

export type RuntimeSession = Session & {
  firstSpeakerIndex?: number;
  speakerMap: Map<number, "interviewer" | "candidate">;
  lastChunkAt: number;
  finalizeStarted: boolean;
};

const memory = new Map<string, RuntimeSession>();

export function getMemorySession(id: string): RuntimeSession | undefined {
  return memory.get(id);
}

export function setMemorySession(session: RuntimeSession): void {
  memory.set(session.id, session);
}

export function deleteMemorySession(id: string): void {
  memory.delete(id);
}

export function listMemorySessions(interviewerId?: string): RuntimeSession[] {
  const all = [...memory.values()];
  if (!interviewerId) return all;
  return all.filter((s) => s.interviewer_id === interviewerId);
}

export function patchSession(
  id: string,
  patch: Partial<RuntimeSession> & { status?: SessionStatus; scoring?: ScoringResult | null },
): RuntimeSession | undefined {
  const cur = memory.get(id);
  if (!cur) return undefined;
  const next: RuntimeSession = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  memory.set(id, next);
  return next;
}

export function appendSegment(id: string, segment: TranscriptSegment): RuntimeSession | undefined {
  const cur = memory.get(id);
  if (!cur) return undefined;
  const next = {
    ...cur,
    transcript: [...cur.transcript, segment],
    status: cur.status === "idle" || cur.status === "capturing" ? ("transcribing" as const) : cur.status,
    updated_at: new Date().toISOString(),
  };
  memory.set(id, next);
  return next;
}
