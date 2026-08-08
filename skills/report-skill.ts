/**
 * ReportSkill
 *
 * A reusable skill that generates a structured Markdown report from a
 * finalized Artemis session. Can be called server-side (e.g. from an API
 * route or a post-session webhook) or from a CLI script.
 *
 * Usage:
 *   import { ReportSkill } from "../skills/report-skill.js";
 *   const md = ReportSkill.generate(session);
 *   // → full Markdown string ready to save, email, or serve
 *
 * The generated report includes:
 *   - Session metadata (candidate, interviewer, date, platform, status)
 *   - Overall score with color band label (Excellent / Good / Needs Work)
 *   - Per-parameter sub-scores as a Markdown table
 *   - Summary bullets, strengths, and improvement tips
 *   - Full transcript with speaker labels
 */

import type { Session, ScoringResult, TranscriptSegment } from "@artemis/shared";
import { SUB_SCORE_LABELS } from "@artemis/shared";

// ── Helpers ─────────────────────────────────────────────────────────────────

function scoreBand(score: number): string {
  if (score >= 80) return "🟢 Excellent";
  if (score >= 60) return "🟡 Good";
  return "🔴 Needs Work";
}

function formatMs(ms: number | undefined): string {
  if (ms == null) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function speakerLabel(
  speaker: TranscriptSegment["speaker"],
  candidateLabel: string,
  interviewerName: string,
): string {
  if (speaker === "candidate") return `**${candidateLabel}**`;
  if (speaker === "interviewer") return `*${interviewerName}*`;
  return "_Unknown_";
}

// ── Score table ─────────────────────────────────────────────────────────────

function renderScoreTable(scoring: ScoringResult): string {
  const header = "| Parameter | Score | Band |\n|---|---|---|";
  const rows = (Object.keys(SUB_SCORE_LABELS) as (keyof typeof SUB_SCORE_LABELS)[])
    .map((k) => {
      const score = Math.round(scoring.sub_scores[k]);
      return `| ${SUB_SCORE_LABELS[k]} | ${score} | ${scoreBand(score)} |`;
    })
    .join("\n");
  return `${header}\n${rows}`;
}

// ── Transcript section ───────────────────────────────────────────────────────

function renderTranscript(
  segments: TranscriptSegment[],
  candidateLabel: string,
  interviewerName: string,
): string {
  if (!segments.length) return "_No transcript segments recorded._";
  return segments
    .map((seg) => {
      const time = seg.startMs != null ? ` _(${formatMs(seg.startMs)})_` : "";
      const label = speakerLabel(seg.speaker, candidateLabel, interviewerName);
      return `> ${label}${time}: ${seg.text}`;
    })
    .join("\n\n");
}

// ── Main export ──────────────────────────────────────────────────────────────

export class ReportSkill {
  /**
   * Generate a Markdown session report from a finalized Session object.
   *
   * @param session  - The full session (must have `scoring` populated for score sections).
   * @returns        - Markdown string.
   */
  static generate(session: Session): string {
    const candidate = session.candidate_label ?? "Interviewee";
    const interviewer = session.interviewer_name ?? "Interviewer";
    const date = new Date(session.started_at).toLocaleString("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const lines: string[] = [];

    // ── Front matter ──────────────────────────────────────────────
    lines.push(`# Interview Report — ${candidate}`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Candidate | ${candidate} |`);
    lines.push(`| Interviewer | ${interviewer} |`);
    lines.push(`| Date | ${date} |`);
    lines.push(`| Platform | ${session.platform ?? "google_meet"} |`);
    lines.push(`| Status | ${session.status} |`);
    lines.push(`| Session ID | \`${session.id}\` |`);
    lines.push("");

    // ── Scoring ───────────────────────────────────────────────────
    if (session.scoring) {
      const s = session.scoring;
      const overall = Math.round(s.overall_score);

      lines.push(`## Overall Score: ${overall}/100 — ${scoreBand(overall)}`);
      lines.push("");
      lines.push(renderScoreTable(s));
      lines.push("");

      if (s.summary.length) {
        lines.push("## Summary");
        s.summary.forEach((b) => lines.push(`- ${b}`));
        lines.push("");
      }

      if (s.strengths.length) {
        lines.push("## Strengths");
        s.strengths.forEach((b) => lines.push(`- ${b}`));
        lines.push("");
      }

      if (s.improvement_tips.length) {
        lines.push("## Improvement Tips");
        s.improvement_tips.forEach((b) => lines.push(`- ${b}`));
        lines.push("");
      }
    } else {
      lines.push(`## Score`);
      lines.push(`_Not yet available (status: ${session.status})._`);
      lines.push("");
    }

    // ── Transcript ────────────────────────────────────────────────
    lines.push("## Transcript");
    lines.push("");
    lines.push(renderTranscript(session.transcript ?? [], candidate, interviewer));
    lines.push("");

    // ── Footer ────────────────────────────────────────────────────
    lines.push("---");
    lines.push(`_Generated by Artemis Interview Copilot · ${new Date().toISOString()}_`);

    return lines.join("\n");
  }

  /**
   * Generate a compact one-page summary (no transcript).
   */
  static summary(session: Session): string {
    const candidate = session.candidate_label ?? "Interviewee";
    const s = session.scoring;
    if (!s) return `# ${candidate} — Score not available\nStatus: ${session.status}`;

    const overall = Math.round(s.overall_score);
    const lines: string[] = [
      `# ${candidate} — ${overall}/100 (${scoreBand(overall)})`,
      "",
      renderScoreTable(s),
      "",
      "**Key strengths:** " + s.strengths.join(" · "),
      "",
      "**Tips:** " + s.improvement_tips.join(" · "),
    ];
    return lines.join("\n");
  }
}
