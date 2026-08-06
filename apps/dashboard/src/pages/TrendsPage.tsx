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
import { DEMO_TREND_ID } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export function TrendsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Session[]>([]);
  const [demo, setDemo] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([
          listSessions(user?.id),
          listSessions(DEMO_TREND_ID),
        ]);
        setMine(a.filter((s) => s.scoring));
        setDemo(b.filter((s) => s.scoring));
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
        })),
    [mine],
  );

  const chartDemo = useMemo(
    () =>
      [...demo]
        .sort((x, y) => +new Date(x.started_at) - +new Date(y.started_at))
        .map((s) => ({
          date: new Date(s.started_at).toLocaleDateString(),
          score: s.scoring!.overall_score,
          name: s.interviewer_name ?? "Jordan Lee",
        })),
    [demo],
  );

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl mb-2">Trends</h1>
        <p className="text-muted text-sm">Overall score over time</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-4">Your sessions</h2>
        {chartMine.length === 0 ? (
          <p className="text-muted text-sm">Not enough scored sessions yet.</p>
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

      <section>
        <h2 className="text-sm font-semibold mb-1">Demo interviewer — Jordan Lee</h2>
        <p className="text-xs text-muted mb-4">
          Pre-loaded seed (`demo-interviewer-b`) for pitch trend chart. Run `npm run seed` with
          Supabase, or use in-memory demo sessions from the server seed script output.
        </p>
        {chartDemo.length === 0 ? (
          <p className="text-muted text-sm">
            No seed data. With DEMO_MODE server memory empty — run seed against Supabase or finalize
            fixture sessions tagged demo-interviewer-b.
          </p>
        ) : (
          <div className="h-[280px] border border-border bg-surface rounded-[4px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDemo}>
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
