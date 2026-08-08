import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { RadarChart } from "@mui/x-charts/RadarChart";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  SUB_SCORE_LABELS,
  type Session,
  type SubScores,
} from "@artemis/shared";
import { listSessions } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PARAM_COLORS } from "../lib/rubricColors";
import { participantColor } from "../lib/participantColors";
import { ParamTrendChart } from "../components/ParamTrendChart";

const PARAM_KEYS = Object.keys(SUB_SCORE_LABELS) as Extract<keyof SubScores, string>[];
const METRIC_LABELS = PARAM_KEYS.map((k) => SUB_SCORE_LABELS[k]);

const radarTheme = createTheme({
  palette: {
    mode: "dark",
    text: { primary: "#fafafa", secondary: "#71717a" },
    background: { default: "#121214", paper: "#1c1c1f" },
    divider: "#27272a",
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: 12,
  },
});

type ChartRow = {
  key: string;
  name: string;
  tick: string;
  date: string;
  overall: number;
  color: string;
} & Record<keyof SubScores, number>;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="border border-border bg-surface-2 px-3 py-2 text-xs rounded-lg shadow-xl min-w-[180px]">
      <p className="font-medium text-text truncate max-w-[220px]">{row.name}</p>
      <p className="text-muted mt-0.5">{row.date}</p>
      <p className="font-mono text-text mt-2">Overall {Math.round(row.overall)}</p>
      <ul className="mt-2 space-y-1">
        {PARAM_KEYS.map((k) => (
          <li key={k} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted">
              <span
                className="inline-block size-2 shrink-0"
                style={{ background: PARAM_COLORS[k] }}
              />
              {SUB_SCORE_LABELS[k]}
            </span>
            <span className="font-mono text-text">{Math.round(row[k])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function axisTick(short: string, index: number, total: number): string {
  if (total <= 8) return short;
  const step = Math.ceil(total / 8);
  return index % step === 0 ? short : "";
}

function uniqueSeriesLabel(base: string, date: string, used: Map<string, number>): string {
  const key = base;
  const n = (used.get(key) ?? 0) + 1;
  used.set(key, n);
  if (n === 1) return base.length > 22 ? `${base.slice(0, 20)}…` : base;
  const withDate = `${base} · ${date}`;
  return withDate.length > 28 ? `${withDate.slice(0, 26)}…` : withDate;
}

/** Build rolling average for a list of numeric values (cumulative mean) */
function rollingAvg(values: number[]): number[] {
  const avgs: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    avgs.push(sum / (i + 1));
  }
  return avgs;
}

export function TrendsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Session ids whose radar series are visible; empty = axes only */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const chartMine = useMemo<ChartRow[]>(() => {
    const sorted = [...mine].sort(
      (x, y) => +new Date(x.started_at) - +new Date(y.started_at),
    );
    const used = new Map<string, number>();
    return sorted.map((s, i) => {
      const sub = s.scoring!.sub_scores;
      const base = (s.candidate_label ?? "Interviewee").trim() || "Interviewee";
      const date = new Date(s.started_at).toLocaleDateString();
      const name = uniqueSeriesLabel(base, date, used);
      const short = name.length > 14 ? `${name.slice(0, 12)}…` : name;
      return {
        key: s.id,
        name,
        tick: axisTick(short, i, sorted.length),
        date,
        overall: s.scoring!.overall_score,
        color: participantColor(i),
        problem_solving: Number.isFinite(sub.problem_solving) ? sub.problem_solving : 0,
        communication: Number.isFinite(sub.communication) ? sub.communication : 0,
        structure: Number.isFinite(sub.structure) ? sub.structure : 0,
        depth: Number.isFinite(sub.depth) ? sub.depth : 0,
        collaboration: Number.isFinite(sub.collaboration) ? sub.collaboration : 0,
        professionalism: Number.isFinite(sub.professionalism) ? sub.professionalism : 0,
      };
    });
  }, [mine]);

  // Drop selections that no longer exist after refresh
  useEffect(() => {
    const ids = new Set(chartMine.map((r) => r.key));
    setSelectedIds((prev) => prev.filter((id) => ids.has(id)));
  }, [chartMine]);

  const radarSeries = useMemo(
    () =>
      chartMine
        .filter((row) => selectedIds.includes(row.key))
        .map((row) => ({
          id: row.key,
          label: row.name,
          data: PARAM_KEYS.map((k) => Math.round(row[k])),
          color: row.color,
          fillArea: true,
          hideMark: false,
        })),
    [chartMine, selectedIds],
  );

  /**
   * Build per-parameter trend data for the 6 line charts.
   * Each point: { label: session short-name, value: score, avg: cumulative avg }
   */
  const paramTrendData = useMemo(() => {
    return PARAM_KEYS.reduce(
      (acc, key) => {
        const values = chartMine.map((r) => r[key] as number);
        const avgs = rollingAvg(values);
        acc[key] = chartMine.map((r, i) => ({
          label:
            r.tick ||
            new Date(mine.find((s) => s.id === r.key)?.started_at ?? "")
              .toLocaleDateString("en", { month: "short", day: "numeric" }),
          value: Math.round(r[key] as number),
          avg: Math.round(avgs[i]!),
        }));
        return acc;
      },
      {} as Record<keyof SubScores, Array<{ label: string; value: number; avg: number }>>,
    );
  }, [chartMine, mine]);

  /** Δ% from first session to last for each param */
  const paramDeltas = useMemo(() => {
    return PARAM_KEYS.reduce(
      (acc, key) => {
        const vals = chartMine.map((r) => r[key] as number);
        if (vals.length < 2) {
          acc[key] = null;
        } else {
          const first = vals[0]!;
          const last = vals[vals.length - 1]!;
          acc[key] = first === 0 ? null : ((last - first) / first) * 100;
        }
        return acc;
      },
      {} as Record<keyof SubScores, number | null>,
    );
  }, [chartMine]);

  function toggleInterviewee(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text">Trends</h1>
        <p className="text-sm text-muted mt-0.5">
          Click interviewees to show on the radar — multi-select overlaps by color
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-text mb-4">Parameter radar</h2>
        {chartMine.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">
            No scored sessions yet. Sign in on the extension with this account, run a Meet capture,
            then refresh.
          </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="relative bg-surface-2 px-2 py-4 sm:px-4">
              <ThemeProvider theme={radarTheme}>
                <RadarChart
                  height={360}
                  series={
                    radarSeries.length > 0
                      ? radarSeries
                      : [
                          // Keep axes visible when nothing selected (transparent)
                          {
                            id: "__empty",
                            label: " ",
                            data: PARAM_KEYS.map(() => 0),
                            color: "transparent",
                            fillArea: false,
                            hideMark: true,
                          },
                        ]
                  }
                  radar={{
                    max: 100,
                    metrics: METRIC_LABELS,
                  }}
                  shape="circular"
                  divisions={4}
                  stripeColor={null}
                  highlight={radarSeries.length > 0 ? "series" : "none"}
                  hideLegend
                  slotProps={{
                    tooltip: { trigger: radarSeries.length > 0 ? "item" : "none" },
                  }}
                />
              </ThemeProvider>
              {selectedIds.length === 0 && (
                <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
                  Select an interviewee below
                </p>
              )}
            </div>
              <div className="flex flex-wrap items-center gap-2 p-4 border-t border-border">
              <button
                type="button"
                className="text-xs text-muted hover:text-text border border-border px-2 py-1 rounded-[4px]"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0}
              >
                Clear
              </button>
              <ul className="flex flex-wrap gap-2 text-xs">
                {chartMine.map((row) => {
                  const on = selectedIds.includes(row.key);
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        onClick={() => toggleInterviewee(row.key)}
                        aria-pressed={on}
                        className={`flex items-center gap-2 border px-2.5 py-1.5 rounded-[4px] transition-colors ${
                          on
                            ? "border-text/40 bg-surface-2 text-text"
                            : "border-border bg-transparent text-muted hover:border-muted hover:text-text"
                        }`}
                      >
                        <span
                          className="inline-block size-2.5 shrink-0"
                          style={{
                            background: row.color,
                            opacity: on ? 1 : 0.35,
                          }}
                        />
                        <span>{row.name}</span>
                        <span className="font-mono opacity-80">{Math.round(row.overall)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>

      {chartMine.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text mb-4">Score mix over time</h2>
          <p className="text-muted text-xs mb-4">
            Stacked rubric parameters per interview (same parameter colors as Sessions)
          </p>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="h-[min(42vh,320px)] min-h-[240px] bg-surface-2 px-2 pt-6 pb-2 sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartMine}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  barCategoryGap="18%"
                >
                  <XAxis
                    dataKey="tick"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#8b9aab", fontSize: 11 }}
                    interval={0}
                    height={36}
                  />
                  <YAxis domain={[0, 600]} hide axisLine={false} tickLine={false} />
                  <ReferenceLine
                    y={0}
                    stroke="#6b7a8a"
                    strokeDasharray="4 6"
                    strokeWidth={1}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={<CustomTooltip />}
                  />
                  {PARAM_KEYS.map((k, idx) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      name={SUB_SCORE_LABELS[k]}
                      stackId="rubric"
                      fill={PARAM_COLORS[k]}
                      maxBarSize={28}
                      isAnimationActive
                      animationDuration={700}
                      animationBegin={idx * 40}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              {PARAM_KEYS.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 shrink-0"
                    style={{ background: PARAM_COLORS[k] }}
                  />
                  {SUB_SCORE_LABELS[k]}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 6 per-parameter trend line charts ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text mb-1">Parameter trends over time</h2>
          <p className="text-muted text-xs">
            Each parameter tracked individually — solid line = actual score, dashed line = cumulative average
          </p>
        </div>

        {chartMine.length === 0 ? (
          <p className="text-muted text-sm">
            No scored sessions yet — run a session to see individual parameter trends.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 20,
            }}
          >
            {PARAM_KEYS.map((key) => (
              <ParamTrendChart
                key={key}
                title={SUB_SCORE_LABELS[key]}
                paramKey={key}
                color={PARAM_COLORS[key]}
                data={paramTrendData[key] ?? []}
                delta={paramDeltas[key] ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
