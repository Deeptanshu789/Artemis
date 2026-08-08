# Agents and Skills — Artemis Interview Copilot

This document describes the custom agent and skill shipped with Artemis, their purpose, inputs, outputs, and how to extend them.

---

## Custom Agent — `ScoringAgent`

**File:** [`agents/scoring-agent.ts`](agents/scoring-agent.ts)

### What it does

`ScoringAgent` is an autonomous LLM-powered agent that receives a raw interview transcript and produces a structured, Zod-validated performance score for the **interviewee**. It is the core intelligence of Artemis.

The agent:
1. Formats the transcript into a role-labelled prompt with HR rubric weights.
2. Calls the **Mistral Chat Completions API** with `response_format: json_object`.
3. Validates the JSON response against `ScoringResultSchema` (Zod).
4. On parse failure, retries once with a repair prompt.
5. On total failure, throws a descriptive error — or falls back to heuristic demo scoring if `SCORING_FALLBACK_DEMO=true`.

### Rubric

| Dimension | Weight | Description |
|---|---|---|
| Problem Solving | 20% | Reasoning, tradeoffs, debugging quality |
| Communication | 20% | Clarity, conciseness, answers the question |
| Answer Structure | 15% | STAR-like or logical structure |
| Technical / Role Depth | 15% | Domain depth vs surface-level answers |
| Collaboration Signals | 15% | Listening, clarifying, teamwork signals |
| Professionalism | 15% | Tone, honesty, composure |

### Input

```ts
interface ScoringAgentInput {
  sessionId: string;
  segments: TranscriptSegment[];   // from Deepgram diarization
  interviewerName?: string;        // Meet display name
  candidateLabel?: string;         // from popup input
}

interface ScoringAgentConfig {
  mistralApiKey: string;
  mistralModel?: string;           // default: mistral-small-latest
  demoMode?: boolean;              // skip real API call
  scoringFallbackDemo?: boolean;   // fallback on API failure
}
```

### Output

```ts
interface ScoringResult {
  overall_score: number;           // 0–100 weighted sum
  sub_scores: {
    problem_solving: number;
    communication: number;
    structure: number;
    depth: number;
    collaboration: number;
    professionalism: number;
  };
  summary: string[];               // 5–6 bullets
  strengths: string[];             // 1–3 items
  improvement_tips: string[];      // 2–4 actionable tips
}
```

### Usage

```ts
import { ScoringAgent } from "./agents/scoring-agent.js";

const agent = new ScoringAgent({
  mistralApiKey: process.env.MISTRAL_API_KEY!,
  mistralModel: "mistral-small-latest",
  demoMode: false,
  scoringFallbackDemo: false,
});

const result = await agent.run({
  sessionId: "abc-123",
  segments: transcript,
  interviewerName: "Alice",
  candidateLabel: "Bob Smith",
});
```

### Model fallback chain

`MISTRAL_MODEL env` → `mistral-small-latest` → `mistral-medium-latest` → `mistral-large-latest`

### How the server uses it

The production server (`apps/server/src/services/scoring.ts`) contains an equivalent inline implementation. The `agents/scoring-agent.ts` file is the clean, standalone, self-documented version of the same agent — portable and independently testable.

---

## Custom Skill — `ReportSkill`

**File:** [`skills/report-skill.ts`](skills/report-skill.ts)

### What it does

`ReportSkill` is a **pure, reusable skill** that converts a finalized `Session` object into a human-readable Markdown report. It has no side effects, no API calls, and no dependencies beyond `@artemis/shared`. Any agent, route, or script can call it.

### Methods

| Method | Output | Use case |
|---|---|---|
| `ReportSkill.generate(session)` | Full Markdown report | Save to file, send by email, display in UI |
| `ReportSkill.summary(session)` | Compact one-page summary | Notifications, Slack messages, embeds |

### Report sections (`generate`)

1. **Front matter table** — candidate, interviewer, date, platform, session ID
2. **Overall score** — numeric score + colour band (🟢 Excellent ≥80 · 🟡 Good ≥60 · 🔴 Needs Work)
3. **Parameter table** — all 6 sub-scores with individual band labels
4. **Summary bullets**
5. **Strengths**
6. **Improvement tips**
7. **Full transcript** — with speaker labels, timestamps, and blockquote formatting
8. **Footer** — generation timestamp

### Usage

```ts
import { ReportSkill } from "./skills/report-skill.js";

// Full report
const markdown = ReportSkill.generate(session);
await fs.writeFile(`reports/${session.id}.md`, markdown);

// Compact summary
const blurb = ReportSkill.summary(session);
await postToSlack(blurb);
```

### Extending the skill

The skill is designed to be forked or extended. Common extensions:

- **PDF export** — pipe `generate()` output into a headless browser or `md-to-pdf`.
- **HTML report** — run the Markdown through a renderer and embed in an email template.
- **ATS integration** — parse the structured sections and POST sub-scores to a Greenhouse / Lever webhook.

---

## Extending Artemis with new agents and skills

### Add a new agent

1. Create `agents/<name>-agent.ts` with a class that has a `run(input)` method.
2. The agent should use Zod to validate its output.
3. Document it in this file under a new `## Custom Agent — <Name>Agent` section.

### Add a new skill

1. Create `skills/<name>-skill.ts` as a class with only `static` methods.
2. Skills must be **pure** — no side effects, no network calls.
3. Document it in this file under a new `## Custom Skill — <Name>Skill` section.

### Ideas for future agents

- **FeedbackAgent** — summarises improvement tips into a draft email to the candidate.
- **BiasDetectionAgent** — flags potentially biased questions from the interviewer.
- **BenchmarkAgent** — compares a candidate's scores against historical averages.

### Ideas for future skills

- **TranscriptCleanupSkill** — removes filler words and disfluencies from segments.
- **QuestionExtractionSkill** — extracts interviewer questions as a structured list.
- **CsvExportSkill** — exports session data as CSV for spreadsheet analysis.
