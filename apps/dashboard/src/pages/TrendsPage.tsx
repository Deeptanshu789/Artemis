import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Session } from "@artemis/shared";
import { listSessions } from "../lib/api";
import { useAuth } from "../lib/auth";

export function TrendsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listSessions(user?.id);
        setMine(rows.filter((s) => s.scoring));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [user]);

  const chartMine = useMemo(
    () =>
      [...mine]
        .sort((x, y) => +new Date(x.started_at) - +new Date(y.started_at))
        .map((s) => ({
          date: new Date(s.started_at).toLocaleDateString(),
          score: s.scoring!.overall_score,
          label: s.candidate_label ?? "Interviewee",
        })),
    [mine],
  );

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl mb-2">Trends</h1>
        <p className="text-muted text-sm">Interviewee overall score over time (your sessions)</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-4">Your interviews</h2>
        {chartMine.length === 0 ? (
          <p className="text-muted text-sm">
            No scored sessions yet. Sign in on the extension with this account, run a Meet capture,
            then refresh.
          </p>
        ) : (
          <div className="h-[280px] border border-border bg-surface rounded-[4px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMine}>
                <CartesianGrid stroke="#2e3d4f" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8b9aab" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#8b9aab" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#1a222c", border: "1px solid #2e3d4f" }}
                />
                <Line type="monotone" dataKey="score" stroke="#3d9a7a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
