import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REGION_COLOR, STATUS_REGIONS, type ChartPoint, type HistoryRange } from "@/lib/serverStatus";

const tickFmt = (range: HistoryRange) => (ts: number) => {
  const d = new Date(ts);
  return range === "24h" ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Stacked areas, one per region. Lazy-loaded by the page so recharts stays out of the main bundle. */
export default function RegionChart({ rows, range }: { rows: ChartPoint[]; range: HistoryRange }) {
  return (
    <div role="img" aria-label={`Players by region, last ${range}`} style={{ width: "100%", height: 280, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--border-soft)" />
          <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={tickFmt(range)} tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis width={44} tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip
            isAnimationActive={false}
            labelFormatter={(ts) => new Date(Number(ts)).toLocaleString()}
            contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", borderRadius: 6 }}
            formatter={(value, name) => [typeof value === "number" ? value.toLocaleString() : value, String(name)]}
          />
          {STATUS_REGIONS.map((r) => (
            <Area key={r.code} type="monotone" dataKey={r.code} name={r.label} stackId="players" stroke={REGION_COLOR[r.code]} fill={REGION_COLOR[r.code]} fillOpacity={0.35} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
