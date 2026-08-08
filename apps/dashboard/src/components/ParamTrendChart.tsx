import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Dot,
} from "recharts";

interface DataPoint {
  label: string;
  value: number;
  avg: number;
}

interface ParamTrendChartProps {
  title: string;
  paramKey: string;
  color: string;
  data: DataPoint[];
  /** Δ% vs first session, e.g. +8.3 or -2.1 */
  delta: number | null;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  stroke?: string;
  payload?: DataPoint;
}) {
  const { cx = 0, cy = 0, stroke = "#06b6d4" } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={stroke}
      stroke="#ffffff"
      strokeWidth={2.5}
    />
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  color,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const score = payload.find((p) => p.name === "value");
  const avg = payload.find((p) => p.name === "avg");
  return (
    <div
      style={{
        background: "#0f1623",
        border: "1px solid #2a3549",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <p style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </p>
      {score && (
        <p style={{ color, marginBottom: 3 }}>
          Score:{" "}
          <span style={{ color: "#fff", fontFamily: "monospace" }}>
            {Math.round(score.value)}
          </span>
        </p>
      )}
      {avg && (
        <p style={{ color: "#8b9aab" }}>
          Avg:{" "}
          <span style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
            {Math.round(avg.value)}
          </span>
        </p>
      )}
    </div>
  );
}

export function ParamTrendChart({
  title,
  color,
  data,
  delta,
}: ParamTrendChartProps) {
  const isEmpty = data.length === 0;
  const deltaPositive = delta !== null && delta >= 0;

  // Lighter tint of the color for glow / area effect
  const glowColor = color + "55";

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #141b2d 0%, #0f1623 100%)",
        borderRadius: 14,
        border: "1px solid #1e2d42",
        padding: "22px 24px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        boxShadow: `0 0 0 1px #1e2d4240, 0 4px 24px #00000050`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top glow accent using param color */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
          opacity: 0.7,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: 15,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>

        {delta !== null && !isEmpty && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: deltaPositive ? "#10b981" : "#f87171",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              style={{
                transform: deltaPositive ? "none" : "rotate(180deg)",
              }}
            >
              <path
                d="M6.5 2L11 8H2L6.5 2Z"
                fill={deltaPositive ? "#10b981" : "#f87171"}
              />
            </svg>
            {deltaPositive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginBottom: 10,
        }}
      >
        {/* Score legend */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "#8b9aab",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: color,
              border: "2.5px solid #ffffff",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          Score
        </span>
        {/* Average legend */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "#8b9aab",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "transparent",
              border: `2.5px solid ${glowColor}`,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          Average
        </span>
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div
          style={{
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4a5568",
            fontSize: 13,
          }}
        >
          No sessions yet
        </div>
      ) : (
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 14, left: -12, bottom: 4 }}
            >
              <defs>
                {/* Glow filter for the score line */}
                <filter id={`glow-${color.replace("#", "")}`}>
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Gradient fill under the score line */}
                <linearGradient
                  id={`area-gradient-${color.replace("#", "")}`}
                  x1="0" y1="0" x2="0" y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="55%" stopColor={color} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#1e2d42"
                strokeDasharray="0"
                vertical={true}
                horizontal={true}
                strokeOpacity={0.7}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b9aab", fontSize: 10 }}
                interval={0}
                height={28}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b9aab", fontSize: 10 }}
                ticks={[0, 25, 50, 75, 100]}
                width={30}
              />
              <Tooltip
                content={<CustomTooltip color={color} />}
                cursor={{
                  stroke: "#2a3549",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              {/* Average dashed line — behind everything */}
              <Area
                type="linear"
                dataKey="avg"
                name="avg"
                stroke={glowColor}
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                activeDot={false}
                fill="none"
                isAnimationActive={true}
                animationDuration={800}
              />
              {/* Score area with gradient shadow + glow line on top */}
              <Area
                type="monotone"
                dataKey="value"
                name="value"
                stroke={color}
                strokeWidth={3}
                fill={`url(#area-gradient-${color.replace("#", "")})`}
                dot={<CustomDot stroke={color} />}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: "#ffffff",
                  strokeWidth: 2.5,
                }}
                isAnimationActive={true}
                animationDuration={1000}
                style={{
                  filter: `drop-shadow(0 0 6px ${color}80)`,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
