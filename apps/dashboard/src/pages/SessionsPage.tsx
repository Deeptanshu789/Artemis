import { useEffect, useState } from "react";
import type { Session } from "@artemis/shared";
import { listSessions } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SUB_SCORE_LABELS } from "@artemis/shared";
import { Link } from "react-router-dom";
import { ScoreBar } from "../components/ScoreBar";
import { PARAM_COLORS } from "../lib/rubricColors";

function scoreColor(n: number) {
  if (n >= 80) return "text-score-high";
  if (n >= 60) return "text-score-mid";
  return "text-score-low";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-accent/10 text-accent border-accent/20",
    scoring: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    capturing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed: "bg-danger/10 text-danger border-danger/20",
    idle: "bg-surface-2 text-muted border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${map[status] ?? map.idle}`}>
      {status}
    </span>
  );
}

export function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listSessions(user?.id);
        if (!cancelled) setSessions(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-32 bg-surface rounded-lg animate-pulse" />
          <div className="h-5 w-20 bg-surface rounded-md animate-pulse" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-danger font-medium">{error}</p>
        <p className="text-muted text-sm mt-2">
          Is the API running? Try <code className="text-accent bg-surface-2 px-1.5 py-0.5 rounded text-xs">DEMO_MODE=true npm run dev:server</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">Sessions</h1>
          <p className="text-sm text-muted mt-0.5">{sessions.length} interview{sessions.length !== 1 ? "s" : ""} recorded</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        /* Empty state */
        <div className="bg-surface border border-border rounded-xl p-12 flex flex-col items-center text-center">
          <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <svg className="size-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
              <path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <p className="text-text font-medium">No sessions yet</p>
          <p className="text-muted text-sm mt-2 max-w-xs">
            Open Google Meet → Artemis extension (signed in) → enter Meet display name → <span className="text-accent">Start listening</span>
          </p>
        </div>
      ) : (
        /* Session grid */
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const overall = s.scoring?.overall_score;
            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="group block bg-surface border border-border rounded-xl p-5 hover:border-accent/40 hover:bg-surface-2/40 transition-all"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{s.candidate_label ?? "Interviewee"}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">
                      {s.interviewer_name ?? s.interviewer_id}
                    </p>
                  </div>
                  {overall != null ? (
                    <span className={`font-mono text-3xl font-bold shrink-0 ${scoreColor(overall)}`}>
                      {Math.round(overall)}
                    </span>
                  ) : (
                    <StatusBadge status={s.status} />
                  )}
                </div>

                {/* Date + status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[11px] text-muted">{new Date(s.started_at).toLocaleString()}</span>
                  {overall != null && <StatusBadge status={s.status} />}
                </div>

                {/* Score bars */}
                {s.scoring && (
                  <div className="space-y-1.5 pt-3 border-t border-border">
                    {(Object.keys(SUB_SCORE_LABELS) as (keyof typeof SUB_SCORE_LABELS)[]).map((k) => (
                      <ScoreBar
                        key={k}
                        label={SUB_SCORE_LABELS[k]}
                        value={s.scoring!.sub_scores[k]}
                        color={PARAM_COLORS[k]}
                        compact
                      />
                    ))}
                  </div>
                )}

                {/* Arrow hint on hover */}
                <div className="mt-3 flex items-center gap-1 text-[11px] text-muted group-hover:text-accent transition-colors">
                  <span>View report</span>
                  <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 6h8M6 2l4 4-4 4"/>
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
