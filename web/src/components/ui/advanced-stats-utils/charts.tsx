import type { DamageDatum } from "@/features/build/damageBreakdown";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Callers retain textual damage/share values outside the lazy chart boundary. */
export default function DamageBreakdownChart({ rows }: { rows: readonly DamageDatum[] }) {
  return (
    <section style={{ minWidth: 0 }}>
      <h3 className="mb-3 text-sm font-semibold text-text">Estimated damage by skill</h3>
      {rows.length === 0 ? <p className="text-sm text-dim">No damage recorded</p> : (
        <div role="img" aria-label="Estimated damage by skill" style={{ width: "100%", height: 320, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={[...rows]} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }} accessibilityLayer={false}>
              <CartesianGrid horizontal={false} stroke="var(--border-soft)" />
              <XAxis type="number" domain={[0, "dataMax"]} tick={{ fill: "var(--text-dim)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fill: "var(--text)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(label: string) => label.length > 18 ? `${label.slice(0, 17)}...` : label} />
              <Tooltip isAnimationActive={false} cursor={{ fill: "var(--surface2)" }} contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", borderRadius: 6 }} formatter={(value) => [typeof value === "number" ? value.toLocaleString() : value, "Damage"]} />
              <Bar dataKey="damage" fill="var(--gold)" isAnimationActive={false} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
