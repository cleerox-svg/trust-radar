import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
  className?: string;
  gradientId?: string;
}

/**
 * Stripe/Mercury-style area chart:
 * - No grid lines
 * - No axis labels
 * - Smooth curve fill with gradient
 * - Clean tooltip on hover
 */
export function AreaSparkline({
  data,
  color = "#3B82F6",
  height = 120,
  showTooltip = true,
  className,
  gradientId = "areaGrad",
}: Props) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          {showTooltip && (
            <Tooltip
              contentStyle={{
                background: "var(--surface-overlay, #1a1f36)",
                border: "1px solid var(--border-subtle, #2d3348)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--text-primary, #f0f0f0)",
                padding: "6px 10px",
              }}
              labelStyle={{ color: "var(--text-tertiary, #888)", fontSize: 10 }}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
