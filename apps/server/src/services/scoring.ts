import {
  ScoringResultSchema,
  type ScoringResult,
  type TranscriptSegment,
  RUBRIC_WEIGHTS,
  SUB_SCORE_LABELS,
} from "@artemis/shared";
import { env } from "../config.js";
import { log } from "./sessionStore.js";

/** Mistral model ids — https://docs.mistral.ai/getting-started/models/ */
const MODEL_CANDIDATES = [
  env.mistralModel,
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

function formatTranscript(segments: TranscriptSegment[]): string {
  if (!segments.length) return "(empty transcript)";
  return segments
    .map((s) => {
      const who =
        s.speaker === "interviewer"
          ? "Interviewer"
          : s.speaker === "candidate"
            ? "Interviewee"
            : "Unknown";
      return `${who}: ${s.text}`;
    })
    .join("\n");
}

export function buildScoringPrompt(
  segments: TranscriptSegment[],
  meta?: { interviewerName?: string; candidateLabel?: string },
): string {
  const weights = Object.entries(RUBRIC_WEIGHTS)
    .map(
      ([k, w]) =>
        `- ${SUB_SCORE_LABELS[k as keyof typeof SUB_SCORE_LABELS]} (${k}): ${Math.round(w * 100)}%`,
    )
    .join("\n");

  const interviewerLabel = meta?.interviewerName?.trim() || "Interviewer";
  const candidateLabel = meta?.candidateLabel?.trim() || "Interviewee";

  return `You are an HR hiring assessor. Score the INTERVIEWEE (candidate) only — not the interviewer.

Speaker labels in the transcript:
- "Interviewer" = the person running the interview (Meet display name: ${interviewerLabel}). They started Artemis capture.
- "Interviewee" = the other speaker (${candidateLabel}). Grade this person.

Rubric weights:
${weights}

Dimensions (about the interviewee):
- problem_solving: reasoned through problems, tradeoffs, debugging / decision quality
- communication: clear, concise, structured explanations; answered the question asked
- structure: STAR-like or logical answer structure; stayed on topic
- depth: technical or role-relevant depth vs surface-level answers
- collaboration: listening, clarifying questions, teamwork / ownership signals
- professionalism: tone, honesty about gaps, respect, composure

Return a JSON object matching this schema (JSON only, no markdown):
{
  "overall_score": 0-100,
  "sub_scores": {
    "problem_solving": 0-100,
    "communication": 0-100,
    "structure": 0-100,
    "depth": 0-100,
    "collaboration": 0-100,
    "professionalism": 0-100
  },
  "summary": ["5-6 short bullets about the interviewee"],
  "strengths": ["1-3 interviewee strengths"],
  "improvement_tips": ["2-4 actionable tips for the interviewee"]
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
  const ratio = talkI + talkC === 0 ? 0.5 : talkC / (talkI + talkC);
  const communication = Math.round(55 + ratio * 40);
  const base = {
    problem_solving: 76,
    communication: Math.max(45, Math.min(95, communication)),
    structure: 72,
    depth: 70,
    collaboration: 74,
    professionalism: 82,
  };
  const overall = Math.round(
    base.problem_solving * RUBRIC_WEIGHTS.problem_solving +
      base.communication * RUBRIC_WEIGHTS.communication +
      base.structure * RUBRIC_WEIGHTS.structure +
      base.depth * RUBRIC_WEIGHTS.depth +
      base.collaboration * RUBRIC_WEIGHTS.collaboration +
      base.professionalism * RUBRIC_WEIGHTS.professionalism,
  );
  return ScoringResultSchema.parse({
    overall_score: overall,
    sub_scores: base,
    summary: [
      "Demo scoring used (DEMO_MODE or SCORING_FALLBACK_DEMO).",
      `Transcript segments: ${segments.length}.`,
      `Approx interviewee talk share: ${Math.round(ratio * 100)}%.`,
      "Answers showed basic structure in mock flow.",
      "Replace with live Mistral scoring in production.",
    ],
    strengths: ["Clear verbal delivery", "Engaged with questions"],
    improvement_tips: [
      "Add concrete metrics / outcomes to stories",
      "State tradeoffs before jumping to a solution",
      "Ask one clarifying question when prompts are ambiguous",
    ],
  });
}

type MistralChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string; type?: string };
};

function messageContent(content: MistralChatResponse["choices"]): string {
  const raw = content?.[0]?.message?.content;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((p) => (typeof p === "string" ? p : p.text ?? "")).join("");
  }
  return "";
}

async function callMistral(prompt: string, model: string): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.mistralApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a scoring API. Always respond with a single valid JSON object.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = (await res.json()) as MistralChatResponse & { message?: string };
  if (!res.ok) {
    const errMsg =
      body.error?.message || body.message || JSON.stringify(body).slice(0, 400);
    throw new Error(`Mistral HTTP ${res.status}: ${errMsg}`);
  }

  const text = messageContent(body.choices).trim();
  if (!text) throw new Error("Mistral returned empty response");
  return text;
}

async function callMistralWithFallback(prompt: string): Promise<{ text: string; model: string }> {
  const errors: string[] = [];
  for (const model of MODEL_CANDIDATES) {
    try {
      const text = await callMistral(prompt, model);
      return { text, model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      log(undefined, "mistral_model_failed", { model, error: msg.slice(0, 400) });
      continue;
    }
  }
  throw new Error(
    `Mistral scoring failed for models [${MODEL_CANDIDATES.join(", ")}]. ${errors.join(" | ")}`,
  );
}

export async function scoreTranscript(
  sessionId: string,
  segments: TranscriptSegment[],
  meta?: { interviewerName?: string; candidateLabel?: string },
): Promise<ScoringResult> {
  if (env.demoMode || !env.mistralApiKey) {
    log(sessionId, "scoring_demo_mode");
    return demoScoring(segments);
  }

  const prompt = buildScoringPrompt(segments, meta);
  try {
    const { text: raw, model } = await callMistralWithFallback(prompt);
    const parsed = ScoringResultSchema.parse(extractJson(raw));
    log(sessionId, "scoring_ok", { overall: parsed.overall_score, model });
    return parsed;
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    log(sessionId, "scoring_parse_retry", { error: msg.slice(0, 500) });
    const repairPrompt = `${prompt}

Your previous answer was invalid. Reply with ONLY the JSON object matching the schema.`;
    try {
      const { text: raw2, model } = await callMistralWithFallback(repairPrompt);
      const parsed = ScoringResultSchema.parse(extractJson(raw2));
      log(sessionId, "scoring_ok_repair", { overall: parsed.overall_score, model });
      return parsed;
    } catch (secondErr) {
      const msg2 = secondErr instanceof Error ? secondErr.message : String(secondErr);
      if (env.scoringFallbackDemo) {
        log(sessionId, "scoring_failed_fallback_demo", { error: msg2.slice(0, 500) });
        return demoScoring(segments);
      }
      log(sessionId, "scoring_failed", { error: msg2.slice(0, 800) });
      throw new Error(
        /401|403|invalid.?api.?key|unauthorized/i.test(msg2)
          ? `Mistral auth failed. Check MISTRAL_API_KEY. ${msg2.slice(0, 240)}`
          : /429|rate.?limit|quota/i.test(msg2)
            ? `Mistral rate limited (model ${env.mistralModel}). Retry later or set SCORING_FALLBACK_DEMO=true. ${msg2.slice(0, 240)}`
            : `Mistral scoring failed: ${msg2.slice(0, 400)}`,
      );
    }
  }
}
