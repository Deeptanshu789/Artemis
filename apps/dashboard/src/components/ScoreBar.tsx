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
  return (
    <div className={compact ? "flex items-center gap-2 text-[10px]" : "flex items-center gap-3 text-sm"}>
      <span className={`text-muted truncate ${compact ? "w-24" : "w-44"}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-surface-2 rounded-[2px] overflow-hidden">
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: fill,
          }}
        />
      </div>
      <span className="font-mono text-muted w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

export function Scorecard({
  overall,
  sub,
}: {
  overall: number;
  sub: SubScores;
}) {
  return (
    <div>
      <div className="font-display text-6xl">{Math.round(overall)}</div>
      <p className="text-muted text-sm mt-1">Overall interviewee score</p>
      <div className="mt-6 space-y-2">
        {(Object.keys(SUB_SCORE_LABELS) as (keyof SubScores)[]).map((k) => (
          <ScoreBar
            key={k}
            label={SUB_SCORE_LABELS[k]}
            value={sub[k]}
            color={PARAM_COLORS[k]}
          />
        ))}
      </div>
    </div>
  );
}
