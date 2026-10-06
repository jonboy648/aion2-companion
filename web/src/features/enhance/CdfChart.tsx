import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Cdf } from "./enhanceMath";

const MAX_POINTS = 120;

/** Chance of being done within n attempts. Lazy-loaded; the numbers it shows are also written out in the page text. */
export default function CdfChart({ cdf, median, p90 }: { cdf: Cdf; median: number | null; p90: number | null }) {
  const last = cdf.cdf.length - 1;
  const stride = Math.max(1, Math.ceil(last / MAX_POINTS));
  const data: { n: number; pct: number }[] = [];
  for (let n = 0; n <= last; n += stride) data.push({ n, pct: +(cdf.cdf[n] * 100).toFixed(2) });
  if (data[data.length - 1].n !== last) data.push({ n: last, pct: +(cdf.cdf[last] * 100).toFixed(2) });
  return (
    <div role="img" aria-label="Chance of finishing within a number of attempts" style={{ width: "100%", height: 220, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--border-soft)" />
          <XAxis dataKey="n" type="number" domain={[0, last]} tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} width={38} unit="%" tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            isAnimationActive={false}
            contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", borderRadius: 6 }}
            labelFormatter={(n) => `Within ${n} attempts`}
            formatter={(v) => [`${v}%`, "Done"]}
          />
          {median !== null && <ReferenceLine x={median} stroke="var(--text-dim)" strokeDasharray="3 3" />}
          {p90 !== null && <ReferenceLine x={p90} stroke="var(--gold)" strokeDasharray="3 3" />}
          <Area type="monotone" dataKey="pct" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.18} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
