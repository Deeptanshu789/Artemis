import { useEffect, useState } from "react";
import type { Session } from "@artemis/shared";
import { listSessions } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SUB_SCORE_LABELS } from "@artemis/shared";
import { Link } from "react-router-dom";
import { ScoreBar } from "../components/ScoreBar";

function scoreColor(n: number) {
  if (n >= 80) return "text-score-high";
  if (n >= 60) return "text-score-mid";
  return "text-score-low";
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
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-surface-2 rounded-[4px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 border border-border bg-surface rounded-[4px]" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <p className="text-danger">{error}</p>
        <p className="text-muted text-sm mt-2">
          Is the API running? Try <code className="text-accent">DEMO_MODE=true npm run dev:server</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Sessions</h1>
      {sessions.length === 0 ? (
        <div className="border border-border bg-surface rounded-[4px] p-8">
          <p className="text-text">No sessions yet.</p>
          <p className="text-muted text-sm mt-2">
            Open Google Meet → Artemis extension (signed in) → enter Meet display name →{" "}
            <span className="text-accent">Start listening</span>. Reports sync to this account.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const overall = s.scoring?.overall_score;
            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="block border border-border bg-surface p-4 rounded-[4px] hover:border-accent transition-colors"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm text-muted">{new Date(s.started_at).toLocaleString()}</p>
                    <p className="mt-1">{s.candidate_label ?? "Interviewee"}</p>
                    <p className="text-xs text-muted mt-1">
                      Host: {s.interviewer_name ?? s.interviewer_id} · {s.status}
                    </p>
                  </div>
                  {overall != null && (
                    <span className={`font-mono text-3xl ${scoreColor(overall)}`}>
                      {Math.round(overall)}
                    </span>
                  )}
                </div>
                {s.scoring && (
                  <div className="mt-4 space-y-1">
                    {(Object.keys(SUB_SCORE_LABELS) as (keyof typeof SUB_SCORE_LABELS)[]).map((k) => (
                      <ScoreBar
                        key={k}
                        label={SUB_SCORE_LABELS[k]}
                        value={s.scoring!.sub_scores[k]}
                        compact
                      />
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
