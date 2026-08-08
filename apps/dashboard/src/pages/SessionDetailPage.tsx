import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Session } from "@artemis/shared";
import { deleteSession, getSession } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Scorecard } from "../components/ScoreBar";

export function SessionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!session) return <p className="text-muted">Loading…</p>;

  const scoring = session.scoring;

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-text">
        ← Sessions
      </Link>
      <div className="mt-4 grid lg:grid-cols-[3fr_2fr] gap-8">
        <section>
          <h1 className="font-display text-3xl mb-2">
            {session.candidate_label ?? "Interviewee"}
          </h1>
          <p className="text-xs text-muted mb-4">
            <span className="text-accent">{session.candidate_label ?? "Interviewee"}</span>
            {" · "}
            Host ({session.interviewer_name ?? "Meet name"})
          </p>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            {session.transcript.length === 0 ? (
              <p className="text-muted">No transcript segments.</p>
            ) : (
              session.transcript.map((seg) => {
                const label =
                  seg.speaker === "candidate"
                    ? (session.candidate_label ?? "Interviewee")
                    : seg.speaker === "interviewer"
                      ? "Host"
                      : "Unknown";
                const isInterviewee = seg.speaker === "candidate";
                return (
                <div
                  key={seg.id}
                  className={`border-l-2 pl-3 ${
                    isInterviewee ? "border-accent" : "border-border"
                  }`}
                >
                  <p className="text-xs text-muted uppercase tracking-wide">
                    {label}
                    {seg.startMs != null ? ` · ${Math.round(seg.startMs / 1000)}s` : ""}
                  </p>
                  <p className="mt-1 text-sm">{seg.text}</p>
                </div>
                );
              })
            )}
          </div>
        </section>

        <section className="border border-border bg-surface p-5 rounded-[4px] h-fit">
          {scoring ? (
            <>
              <Scorecard overall={scoring.overall_score} sub={scoring.sub_scores} />
              <div className="mt-8">
                <h2 className="text-sm font-semibold mb-2">Summary</h2>
                <ul className="list-disc pl-5 text-sm text-muted space-y-1">
                  {scoring.summary.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-6">
                <h2 className="text-sm font-semibold mb-2">Strengths</h2>
                <ul className="list-disc pl-5 text-sm text-muted space-y-1">
                  {scoring.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-6">
                <h2 className="text-sm font-semibold mb-2">Improvement tips</h2>
                <ul className="list-disc pl-5 text-sm text-muted space-y-1">
                  {scoring.improvement_tips.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-muted">Status: {session.status}. Score not ready.</p>
          )}

          <div className="mt-8 pt-4 border-t border-border">
            {!confirmDelete ? (
              <button
                type="button"
                className="text-danger text-sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete session
              </button>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">Delete permanently?</span>
                <button
                  type="button"
                  className="text-danger font-semibold"
                  onClick={async () => {
                    await deleteSession(session.id, user?.id);
                    nav("/");
                  }}
                >
                  Confirm
                </button>
                <button type="button" className="text-muted" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
