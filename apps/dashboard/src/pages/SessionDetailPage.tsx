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

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface rounded-lg" />
        <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
          <div className="h-96 bg-surface border border-border rounded-xl" />
          <div className="h-96 bg-surface border border-border rounded-xl" />
        </div>
      </div>
    );
  }

  const scoring = session.scoring;
  const candidateName = session.candidate_label ?? "Interviewee";

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors mb-2">
            <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 6H2M6 10L2 6l4-4"/>
            </svg>
            Sessions
          </Link>
          <h1 className="text-xl font-semibold text-text">{candidateName}</h1>
          <p className="text-sm text-muted mt-0.5">
            Interviewed by <span className="text-text">{session.interviewer_name ?? "Unknown"}</span>
            {" · "}{new Date(session.started_at).toLocaleString()}
          </p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border
          ${session.status === "ready"
            ? "bg-accent/10 text-accent border-accent/20"
            : "bg-surface-2 text-muted border-border"}`}>
          {session.status}
        </span>
      </div>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-5">

        {/* ── Transcript panel ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Transcript</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent inline-block" />
                {candidateName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-border inline-block" />
                Host
              </span>
            </div>
          </div>

          <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
            {session.transcript.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center">No transcript segments.</p>
            ) : (
              session.transcript.map((seg) => {
                const isCandidate = seg.speaker === "candidate";
                const label = isCandidate
                  ? candidateName
                  : seg.speaker === "interviewer"
                    ? "Host"
                    : "Unknown";
                return (
                  <div
                    key={seg.id}
                    className={`border-l-2 pl-4 py-1 ${isCandidate ? "border-accent" : "border-border"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-widest ${isCandidate ? "text-accent" : "text-muted"}`}>
                        {label}
                      </span>
                      {seg.startMs != null && (
                        <span className="text-[10px] text-muted-2">{Math.round(seg.startMs / 1000)}s</span>
                      )}
                    </div>
                    <p className="text-sm text-text leading-relaxed">{seg.text}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Scorecard panel ── */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            {scoring ? (
              <>
                <Scorecard overall={scoring.overall_score} sub={scoring.sub_scores} />

                <div className="mt-6 space-y-4 pt-5 border-t border-border">
                  {[
                    { title: "Summary", items: scoring.summary },
                    { title: "Strengths", items: scoring.strengths },
                    { title: "Improvement tips", items: scoring.improvement_tips },
                  ].map(({ title, items }) => (
                    <div key={title}>
                      <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-2">{title}</h3>
                      <ul className="space-y-1.5">
                        {items.map((s) => (
                          <li key={s} className="flex gap-2 text-sm text-muted">
                            <span className="mt-1.5 size-1.5 rounded-full bg-muted-2 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                  <svg className="size-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 3"/>
                  </svg>
                </div>
                <p className="text-muted text-sm">Status: {session.status}</p>
                <p className="text-muted-2 text-xs mt-1">Score not ready yet.</p>
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="bg-surface border border-border rounded-xl p-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 text-sm text-muted hover:text-danger transition-colors"
              >
                <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/>
                </svg>
                Delete session
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text">Delete this session permanently?</p>
                <p className="text-xs text-muted">This cannot be undone.</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteSession(session.id, user?.id);
                      nav("/");
                    }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg text-sm text-muted border border-border hover:text-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
