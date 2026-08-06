import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  ScoringResultSchema,
  type ScoringResult,
  type TranscriptSegment,
  RUBRIC_WEIGHTS,
  SUB_SCORE_LABELS,
} from "@artemis/shared";
import { env } from "../config.js";
import { log } from "./sessionStore.js";

function formatTranscript(segments: TranscriptSegment[]): string {
  if (!segments.length) return "(empty transcript)";
  return segments
    .map((s) => {
      const who =
        s.speaker === "interviewer"
          ? "Interviewer"
          : s.speaker === "candidate"
            ? "Candidate"
            : "Unknown";
      return `${who}: ${s.text}`;
    })
    .join("\n");
}

export function buildScoringPrompt(segments: TranscriptSegment[]): string {
  const weights = Object.entries(RUBRIC_WEIGHTS)
    .map(
      ([k, w]) =>
        `- ${SUB_SCORE_LABELS[k as keyof typeof SUB_SCORE_LABELS]} (${k}): ${Math.round(w * 100)}%`,
    )
    .join("\n");

  return `You are an HR interview-quality auditor. Score the INTERVIEWER only (not the candidate).

Rubric weights:
${weights}

Dimensions:
- structure: clear structure, covered role-relevant topics
- active_listening: follow-ups, no interrupting, responded to what candidate said
- clarity: clear questions, no rambling
- time_management: balanced talk-time, pacing
- fairness: no leading/inappropriate questions
- candidate_experience: rapport, space for candidate questions, professional close

Return STRICT JSON only (no markdown fences, no prose). Schema:
{
  "overall_score": 0-100,
  "sub_scores": {
    "structure": 0-100,
    "active_listening": 0-100,
    "clarity": 0-100,
    "time_management": 0-100,
    "fairness": 0-100,
    "candidate_experience": 0-100
  },
  "summary": ["5-6 short bullets about the interview"],
  "strengths": ["1-3 interviewer strengths"],
  "improvement_tips": ["2-4 actionable tips for the interviewer"]
}

overall_score should approximate the weighted sum of sub_scores.

Transcript:
${formatTranscript(segments)}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export function demoScoring(segments: TranscriptSegment[]): ScoringResult {
  const talkI = segments.filter((s) => s.speaker === "interviewer").length;
  const talkC = segments.filter((s) => s.speaker === "candidate").length;
  const ratio = talkI + talkC === 0 ? 0.5 : talkI / (talkI + talkC);
  const timeMgmt = Math.round(100 - Math.abs(ratio - 0.45) * 120);
  const base = {
    structure: 78,
    active_listening: 72,
    clarity: 80,
    time_management: Math.max(40, Math.min(95, timeMgmt)),
    fairness: 88,
    candidate_experience: 75,
  };
  const overall = Math.round(
    base.structure * 0.2 +
      base.active_listening * 0.2 +
      base.clarity * 0.15 +
      base.time_management * 0.15 +
      base.fairness * 0.15 +
      base.candidate_experience * 0.15,
  );
  return ScoringResultSchema.parse({
    overall_score: overall,
    sub_scores: base,
    summary: [
      "Demo scoring used (DEMO_MODE or missing GEMINI_API_KEY).",
      `Transcript segments: ${segments.length}.`,
      `Approx interviewer talk share: ${Math.round(ratio * 100)}%.`,
      "Structure looked present in mock flow.",
      "Replace with live Gemini scoring in production.",
    ],
    strengths: ["Kept conversation moving", "Covered core topics"],
    improvement_tips: [
      "Leave more silence after candidate answers before follow-ups",
      "Balance talk time closer to 40/60 interviewer/candidate",
      "Ask one clarifying question before moving topics",
    ],
  });
}

async function callGemini(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: env.geminiModel,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("Gemini returned empty response");
  }
  return text;
}

export async function scoreTranscript(
  sessionId: string,
  segments: TranscriptSegment[],
): Promise<ScoringResult> {
  if (env.demoMode || !env.geminiApiKey) {
    log(sessionId, "scoring_demo_mode");
    return demoScoring(segments);
  }

  const prompt = buildScoringPrompt(segments);
  try {
    const raw = await callGemini(prompt);
    const parsed = ScoringResultSchema.parse(extractJson(raw));
    log(sessionId, "scoring_ok", { overall: parsed.overall_score, model: env.geminiModel });
    return parsed;
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    log(sessionId, "scoring_parse_retry", { error: msg });
    const repairPrompt = `${prompt}

Your previous answer was invalid. Reply with ONLY the JSON object matching the schema.`;
    try {
      const raw2 = await callGemini(repairPrompt);
      return ScoringResultSchema.parse(extractJson(raw2));
    } catch (secondErr) {
      const msg2 = secondErr instanceof Error ? secondErr.message : String(secondErr);
      log(sessionId, "scoring_failed_fallback_demo", { error: msg2 });
      // Quota / network / parse: keep demo flowing instead of hard-failing the session
      if (/429|quota|rate limit|fetch/i.test(msg2) || /429|quota|rate limit|fetch/i.test(msg)) {
        return demoScoring(segments);
      }
      throw secondErr;
    }
  }
}
