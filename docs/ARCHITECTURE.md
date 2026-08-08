# Artemis — Architecture

## Overview

Artemis is an AI-powered interview copilot that captures Google Meet audio in real time, transcribes and diarizes it, scores the **interviewee** using an LLM rubric, and surfaces results to the interviewer via a React dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                         │
│  ┌────────────┐  tabCapture  ┌─────────────┐  PCM chunks       │
│  │   Popup    │─────────────▶│  Offscreen  │──────────────┐    │
│  │ (login +   │              │  (AudioCtx  │              │    │
│  │  controls) │              │  16kHz mono)│              │    │
│  └─────┬──────┘              └─────────────┘              │    │
│        │ REST POST /sessions                               │    │
│        │ WS  /ws/audio ◀───────────────────────────────── │    │
│  ┌─────▼──────┐                                           │    │
│  │  Service   │ WS binary audio ──────────────────────────┘    │
│  │  Worker    │                                                 │
│  └────────────┘                                                 │
│  ┌─────────────┐                                                │
│  │Content Script│ Meet consent banner                           │
│  └─────────────┘                                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Node/Express Server  (apps/server)                             │
│                                                                 │
│  POST /sessions  ──▶ create RuntimeSession ──▶ Supabase upsert │
│  WS /ws/audio    ──▶ DeepgramSession (live STT + diarize)      │
│                       │ TranscriptSegments                      │
│                       ▼                                         │
│                  ScoringAgent (Mistral Chat API)                │
│                       │ ScoringResult (Zod-validated JSON)      │
│                       ▼                                         │
│                  persistSession() ──▶ Supabase Postgres         │
│                  ReportSkill  ──▶ Markdown session report       │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase Postgres (Drizzle ORM)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  React Dashboard  (apps/dashboard — Vite + Tailwind)            │
│                                                                 │
│  /login         Supabase Auth (Google OAuth / email)            │
│  /             Sessions list  (grid cards, score bars)          │
│  /sessions/:id  Transcript + Scorecard + delete                 │
│  /trends        Radar · stacked bar · 6 param trend lines       │
│  /privacy       Retention / consent notes                       │
└─────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3 · TypeScript · Vite · Supabase-js (auth only) |
| Server | Node 20 · Express · `ws` · `tsx` (dev) |
| STT | Deepgram Nova-2 live WebSocket (diarization enabled) |
| LLM scoring | Mistral Chat Completions API (`mistral-small-latest` default) |
| DB / Auth | Supabase Postgres · Drizzle ORM (schema push + seed) |
| Dashboard | Vite · React 18 · Tailwind CSS v4 · Recharts · MUI X Charts |
| Shared | `@artemis/shared` — Zod schemas, rubric weights, WS message types |

## Data Model

### `sessions` table (Drizzle / Postgres)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Random UUID per session |
| `interviewer_id` | `text` NOT NULL | Supabase `user.id` of the interviewer |
| `interviewer_name` | `text` | Meet display name |
| `candidate_label` | `text` | Interviewee's real name (entered in popup) |
| `status` | `text` NOT NULL | `idle → capturing → transcribing → scoring → ready \| failed` |
| `platform` | `text` | `google_meet` (default) |
| `transcript` | `jsonb` | Array of `TranscriptSegment` |
| `scoring` | `jsonb` | `ScoringResult` (null until finalized) |
| `error_message` | `text` | Set on `failed` |
| `started_at` | `timestamptz` | Session start |
| `ended_at` | `timestamptz` | Set on finalize |
| `created_at` | `timestamptz` | Row creation |
| `updated_at` | `timestamptz` | Updated on every persist |

### `TranscriptSegment` (Zod / shared)

```ts
{ id, speaker: "interviewer"|"candidate"|"unknown", text, startMs?, endMs?, confidence?, speakerIndex? }
```

### `ScoringResult` (Zod / shared)

```ts
{
  overall_score: 0-100,
  sub_scores: { problem_solving, communication, structure, depth, collaboration, professionalism },
  summary: string[],
  strengths: string[],
  improvement_tips: string[]
}
```

## Session State Machine

```
idle ──Start──▶ capturing ──Deepgram Open──▶ transcribing
                                                  │
                                              Stop / WS end
                                                  │
                                                scoring ──Mistral──▶ ready
                                                                        │
                                           (any error) ──────────▶ failed
```

## Agents & Skills

- **ScoringAgent** (`agents/scoring-agent.ts`) — Calls Mistral Chat API with a structured HR rubric prompt, validates the JSON response with Zod, retries once on parse failure, and optionally falls back to heuristic demo scoring.
- **ReportSkill** (`skills/report-skill.ts`) — Reusable skill that generates a structured Markdown session report from a `Session` object, usable server-side or in scripts.

See [`AGENTS_AND_SKILLS.md`](../AGENTS_AND_SKILLS.md) for full documentation.

## Key Design Decisions

- **Diarization tag assignment** — The first speaker detected after the interviewer clicks Start is tagged as `interviewer`; all others as `candidate`. This works because the interviewer should speak first.
- **PCM over WebM** — The offscreen document resamples to 16 kHz mono linear16 PCM before sending, matching Deepgram's preferred format for lowest latency.
- **Zod everywhere** — All WS messages, session data, and scoring results are Zod-validated at the boundary. Invalid Mistral responses trigger a one-shot repair prompt before failing the session.
- **Idempotent finalize** — `finalizeSession()` is guarded by `finalizeStarted` flag so duplicate Stop signals or HTTP calls don't double-charge the Mistral API.
- **Auth scoping** — Sessions include `interviewer_id = supabase user.id`; dashboard queries filter by this field so each interviewer only sees their own sessions.
