import { z } from "zod";

export const SessionStatusSchema = z.enum([
  "idle",
  "capturing",
  "transcribing",
  "scoring",
  "ready",
  "failed",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SpeakerRoleSchema = z.enum(["interviewer", "candidate", "unknown"]);
export type SpeakerRole = z.infer<typeof SpeakerRoleSchema>;

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  speaker: SpeakerRoleSchema,
  speakerIndex: z.number().int().nonnegative().optional(),
  text: z.string(),
  startMs: z.number().nonnegative().optional(),
  endMs: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const SubScoresSchema = z.object({
  structure: z.number().min(0).max(100),
  active_listening: z.number().min(0).max(100),
  clarity: z.number().min(0).max(100),
  time_management: z.number().min(0).max(100),
  fairness: z.number().min(0).max(100),
  candidate_experience: z.number().min(0).max(100),
});
export type SubScores = z.infer<typeof SubScoresSchema>;

export const ScoringResultSchema = z.object({
  overall_score: z.number().min(0).max(100),
  sub_scores: SubScoresSchema,
  summary: z.array(z.string()).min(1).max(8),
  strengths: z.array(z.string()).min(1).max(6),
  improvement_tips: z.array(z.string()).min(1).max(6),
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  interviewer_id: z.string(),
  interviewer_name: z.string().optional(),
  candidate_label: z.string().optional(),
  status: SessionStatusSchema,
  platform: z.literal("google_meet").default("google_meet"),
  transcript: z.array(TranscriptSegmentSchema).default([]),
  scoring: ScoringResultSchema.nullable().optional(),
  error_message: z.string().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

/** Client → server over WS */
export const WsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start"),
    sessionId: z.string().uuid(),
    interviewerId: z.string().optional(),
    interviewerName: z.string().optional(),
    mimeType: z.string().optional(),
    /** linear16 PCM @ 16kHz mono preferred for Deepgram */
    encoding: z.enum(["linear16", "webm"]).optional(),
    sampleRate: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("audio"),
    sessionId: z.string().uuid(),
    /** base64-encoded chunk */
    data: z.string(),
    sequence: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("end"),
    sessionId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("ping"),
    sessionId: z.string().uuid().optional(),
  }),
]);
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>;

/** Server → client over WS */
export const WsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ack"),
    sessionId: z.string(),
    status: SessionStatusSchema,
  }),
  z.object({
    type: z.literal("transcript"),
    sessionId: z.string(),
    segment: TranscriptSegmentSchema,
  }),
  z.object({
    type: z.literal("status"),
    sessionId: z.string(),
    status: SessionStatusSchema,
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("result"),
    sessionId: z.string(),
    scoring: ScoringResultSchema,
  }),
  z.object({
    type: z.literal("error"),
    sessionId: z.string().optional(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("nudge"),
    sessionId: z.string(),
    kind: z.literal("talk_ratio"),
    interviewerShare: z.number().min(0).max(1),
    message: z.string(),
  }),
  z.object({
    type: z.literal("pong"),
  }),
]);
export type WsServerMessage = z.infer<typeof WsServerMessageSchema>;

/** Char-count talk share for interviewer (0–1). */
export function interviewerTalkShare(
  segments: Array<{ speaker: string; text: string }>,
): number {
  let i = 0;
  let c = 0;
  for (const s of segments) {
    const n = s.text.length;
    if (s.speaker === "interviewer") i += n;
    else if (s.speaker === "candidate") c += n;
  }
  const t = i + c;
  return t === 0 ? 0.5 : i / t;
}

export const RUBRIC_WEIGHTS = {
  structure: 0.2,
  active_listening: 0.2,
  clarity: 0.15,
  time_management: 0.15,
  fairness: 0.15,
  candidate_experience: 0.15,
} as const;

export const SUB_SCORE_LABELS: Record<keyof SubScores, string> = {
  structure: "Structure & Preparation",
  active_listening: "Active Listening",
  clarity: "Communication Clarity",
  time_management: "Time Management",
  fairness: "Fairness & Bias Signals",
  candidate_experience: "Candidate Experience",
};
