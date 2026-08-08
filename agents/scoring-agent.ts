/**
 * ScoringAgent
 *
 * A self-contained agent that receives a session transcript and interviewee
 * metadata, calls the Mistral Chat Completions API with a structured HR rubric
 * prompt, validates the JSON response with Zod, and returns a ScoringResult.
 *
 * Retry logic:
 *   1. Calls Mistral with the primary prompt.
 *   2. On Zod parse failure, sends a one-shot repair prompt.
 *   3. On total failure, throws a descriptive error (or falls back to demo
 *      scoring if SCORING_FALLBACK_DEMO=true).
 *
 * Model fallback order:
 *   env.MISTRAL_MODEL → mistral-small-latest → mistral-medium-latest → mistral-large-latest
 */

import {
  ScoringResultSchema,
  type ScoringResult,
  type TranscriptSegment,
  RUBRIC_WEIGHTS,
  SUB_SCORE_LABELS,
} from "@artemis/shared";
import { log } from "../apps/server/src/services/sessionStore.js";

export interface ScoringAgentInput {
  sessionId: string;
  segments: TranscriptSegment[];
  interviewerName?: string;
  candidateLabel?: string;
}

export interface ScoringAgentConfig {
  mistralApiKey: string;
  mistralModel?: string;
  demoMode?: boolean;
  scoringFallbackDemo?: boolean;
}

// ── Prompt builder ──────────────────────────────────────────────────────────

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

// ── JSON extraction ─────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

// ── Mistral API call ────────────────────────────────────────────────────────

type MistralChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string; type?: string };
  message?: string;
};

function messageContent(choices: MistralChatResponse["choices"]): string {
  const raw = choices?.[0]?.message?.content;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((p) => (typeof p === "string" ? p : p.text ?? "")).join("");
  return "";
}

async function callMistral(prompt: string, model: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a scoring API. Always respond with a single valid JSON object." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = (await res.json()) as MistralChatResponse;
  if (!res.ok) {
    const errMsg = body.error?.message || body.message || JSON.stringify(body).slice(0, 400);
    throw new Error(`Mistral HTTP ${res.status}: ${errMsg}`);
  }
  const text = messageContent(body.choices).trim();
  if (!text) throw new Error("Mistral returned empty response");
  return text;
}

async function callMistralWithFallback(
  prompt: string,
  config: ScoringAgentConfig,
): Promise<{ text: string; model: string }> {
  const candidates = [
    config.mistralModel,
    "mistral-small-latest",
    "mistral-medium-latest",
    "mistral-large-latest",
  ].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

  const errors: string[] = [];
  for (const model of candidates) {
    try {
      const text = await callMistral(prompt, model, config.mistralApiKey);
      return { text, model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
    }
  }
  throw new Error(`Mistral scoring failed for all models. ${errors.join(" | ")}`);
}

// ── Demo / heuristic fallback ───────────────────────────────────────────────

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
    ],
    strengths: ["Clear verbal delivery", "Engaged with questions"],
    improvement_tips: [
      "Add concrete metrics / outcomes to stories",
      "State tradeoffs before jumping to a solution",
    ],
  });
}

// ── Main agent entry point ──────────────────────────────────────────────────

/**
 * ScoringAgent.run()
 *
 * Orchestrates the full scoring pipeline for one session:
 *   1. Short-circuit to demo scoring in DEMO_MODE or without an API key.
 *   2. Build the HR rubric prompt from the transcript.
 *   3. Call Mistral with model fallback chain.
 *   4. Zod-validate the response; retry once with a repair prompt on failure.
 *   5. Return the validated ScoringResult.
 */
export class ScoringAgent {
  constructor(private config: ScoringAgentConfig) {}

  async run(input: ScoringAgentInput): Promise<ScoringResult> {
    const { sessionId, segments, interviewerName, candidateLabel } = input;

    if (this.config.demoMode || !this.config.mistralApiKey) {
      return demoScoring(segments);
    }

    const prompt = buildScoringPrompt(segments, { interviewerName, candidateLabel });

    // First attempt
    try {
      const { text, model } = await callMistralWithFallback(prompt, this.config);
      const parsed = ScoringResultSchema.parse(extractJson(text));
      console.log(JSON.stringify({ ts: new Date().toISOString(), sessionId, msg: "scoring_ok", overall: parsed.overall_score, model }));
      return parsed;
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.log(JSON.stringify({ ts: new Date().toISOString(), sessionId, msg: "scoring_parse_retry", error: msg.slice(0, 500) }));

      // Repair attempt
      const repairPrompt = `${prompt}\n\nYour previous answer was invalid. Reply with ONLY the JSON object matching the schema.`;
      try {
        const { text: text2, model } = await callMistralWithFallback(repairPrompt, this.config);
        const parsed = ScoringResultSchema.parse(extractJson(text2));
        console.log(JSON.stringify({ ts: new Date().toISOString(), sessionId, msg: "scoring_ok_repair", overall: parsed.overall_score, model }));
        return parsed;
      } catch (secondErr) {
        const msg2 = secondErr instanceof Error ? secondErr.message : String(secondErr);
        if (this.config.scoringFallbackDemo) {
          return demoScoring(segments);
        }
        throw new Error(
          /401|403|invalid.?api.?key|unauthorized/i.test(msg2)
            ? `Mistral auth failed. Check MISTRAL_API_KEY. ${msg2.slice(0, 240)}`
            : /429|rate.?limit|quota/i.test(msg2)
              ? `Mistral rate limited. Retry later or set SCORING_FALLBACK_DEMO=true. ${msg2.slice(0, 240)}`
              : `Mistral scoring failed: ${msg2.slice(0, 400)}`,
        );
      }
    }
  }
}
