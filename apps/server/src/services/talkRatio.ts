import { interviewerTalkShare } from "@artemis/shared";
import type { TranscriptSegment } from "@artemis/shared";

const lastNudgeAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const THRESHOLD = 0.7;

export function maybeTalkRatioNudge(
  sessionId: string,
  transcript: TranscriptSegment[],
): { interviewerShare: number; message: string } | null {
  if (transcript.length < 4) return null;
  const share = interviewerTalkShare(transcript);
  if (share < THRESHOLD) return null;
  const last = lastNudgeAt.get(sessionId) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return null;
  lastNudgeAt.set(sessionId, Date.now());
  const pct = Math.round(share * 100);
  return {
    interviewerShare: share,
    message: `You've talked ~${pct}% of the time — leave more space for the candidate.`,
  };
}

export function resetNudge(sessionId: string): void {
  lastNudgeAt.delete(sessionId);
}
