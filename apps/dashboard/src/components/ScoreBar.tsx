import { SUB_SCORE_LABELS, type SubScores } from "@artemis/shared";
import { PARAM_COLORS } from "../lib/rubricColors";

export function ScoreBar({
  label,
  value,
  color,
  compact,
}: {
  label: string;
  value: number;
  /** Rubric parameter fill — defaults to accent if omitted */
  color?: string;
  compact?: boolean;
}) {
  const fill = color ?? "var(--color-accent)";
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-[10px]" : "text-sm"}`}>
      <span className={`text-muted truncate ${compact ? "w-24" : "w-44"}`}>{label}</span>
      <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <span className="font-mono text-muted w-7 text-right">{Math.round(value)}</span>
    </div>
  );
}

export function Scorecard({ overall, sub }: { overall: number; sub: SubScores }) {
  const color = overall >= 80 ? "text-score-high" : overall >= 60 ? "text-score-mid" : "text-score-low";
  return (
    <div>
      <div className="flex items-end gap-3 mb-1">
        <span className={`font-mono text-6xl font-bold leading-none ${color}`}>{Math.round(overall)}</span>
        <span className="text-muted text-sm mb-1">/100</span>
      </div>
      <p className="text-muted text-xs mb-5">Overall interviewee score</p>
      <div className="space-y-2.5">
        {(Object.keys(SUB_SCORE_LABELS) as Extract<keyof SubScores, string>[]).map((k) => (
          <ScoreBar key={k} label={SUB_SCORE_LABELS[k]} value={sub[k]} color={PARAM_COLORS[k]} />
        ))}
      </div>
    </div>
  );
}
