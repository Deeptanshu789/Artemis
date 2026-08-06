import { randomUUID } from "node:crypto";
import type { ScoringResult, TranscriptSegment } from "@artemis/shared";
import { RUBRIC_WEIGHTS } from "@artemis/shared";
import { getDb, databaseUrlConfigured, closeDb } from "../db/client.js";
import { sessions } from "../db/schema.js";
import { setMemorySession, type RuntimeSession, log } from "./sessionStore.js";

function score(overall: number): ScoringResult {
  const base = Math.max(40, overall - 5);
  const sub = {
    problem_solving: Math.min(100, base + 4),
    communication: Math.max(0, base - 2),
    structure: Math.min(100, base + 1),
    depth: Math.max(0, base - 4),
    collaboration: Math.min(95, base + 3),
    professionalism: Math.min(100, base + 6),
  };
  const weighted = Math.round(
    sub.problem_solving * RUBRIC_WEIGHTS.problem_solving +
      sub.communication * RUBRIC_WEIGHTS.communication +
      sub.structure * RUBRIC_WEIGHTS.structure +
      sub.depth * RUBRIC_WEIGHTS.depth +
      sub.collaboration * RUBRIC_WEIGHTS.collaboration +
      sub.professionalism * RUBRIC_WEIGHTS.professionalism,
  );
  return {
    overall_score: overall || weighted,
    sub_scores: sub,
    summary: [
      "Covered role competencies with concrete examples.",
      "Communication was mostly clear.",
      "Some answers stayed high-level.",
      "Collaborative tone throughout.",
      "Professional close.",
    ],
    strengths: ["Clear verbal delivery", "Ownership language"],
    improvement_tips: [
      "Quantify impact in stories",
      "Explain tradeoffs before the solution",
      "Ask clarifying questions when prompts are vague",
    ],
  };
}

function buildRows(): RuntimeSession[] {
  const interviewerB = "demo-interviewer-b";
  const now = Date.now();
  const scores = [62, 68, 71, 74, 79];
  return scores.map((overall, i) => {
    const started = new Date(now - (5 - i) * 86400000);
    const id = randomUUID();
    const transcript: TranscriptSegment[] = [
      { id: randomUUID(), speaker: "interviewer", text: "Tell me about a hard bug you fixed." },
      { id: randomUUID(), speaker: "candidate", text: "We had a race in our job queue…" },
    ];
    return {
      id,
      interviewer_id: interviewerB,
      interviewer_name: "Jordan Lee",
      candidate_label: `Interviewee ${i + 1}`,
      status: "ready" as const,
      platform: "google_meet" as const,
      transcript,
      scoring: score(overall),
      error_message: null,
      started_at: started.toISOString(),
      ended_at: started.toISOString(),
      created_at: started.toISOString(),
      updated_at: started.toISOString(),
      speakerMap: new Map(),
      lastChunkAt: Date.now(),
      finalizeStarted: true,
    };
  });
}

/** Seed Jordan Lee demo sessions via Drizzle (Postgres). Also mirrors into memory. */
export async function seedDemoInterviewerB(): Promise<number> {
  const rows = buildRows();
  for (const session of rows) {
    setMemorySession(session);
  }

  if (!databaseUrlConfigured()) {
    log(undefined, "seed_drizzle_skip_no_database_url", { memoryOnly: rows.length });
    return rows.length;
  }

  const db = getDb();
  await db
    .insert(sessions)
    .values(
      rows.map((s) => ({
        id: s.id,
        interviewerId: s.interviewer_id,
        interviewerName: s.interviewer_name ?? null,
        candidateLabel: s.candidate_label ?? null,
        status: s.status,
        platform: s.platform ?? "google_meet",
        transcript: s.transcript,
        scoring: s.scoring,
        errorMessage: s.error_message,
        startedAt: new Date(s.started_at),
        endedAt: s.ended_at ? new Date(s.ended_at) : null,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      })),
    )
    .onConflictDoNothing({ target: sessions.id });

  log(undefined, "seed_demo_interviewer_b_drizzle", { count: rows.length });
  return rows.length;
}

export async function seedAndClose(): Promise<number> {
  try {
    return await seedDemoInterviewerB();
  } finally {
    await closeDb().catch(() => undefined);
  }
}
