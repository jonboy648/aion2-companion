import { Component, lazy, Suspense, type ReactNode } from "react";
import type { FullBuild } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { damageBreakdown } from "./damageBreakdown";
import { fmtDps, skillName } from "./helpers";
import { buildGoal } from "./objective";

const Chart = lazy(() => import("@/components/ui/advanced-stats-utils/charts"));

export class DamageChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="text-xs text-dim">Chart unavailable. Damage values remain below.</p> : this.props.children; }
}

export function BuildDamage({ fb, data }: { fb: FullBuild; data: ClassData }) {
  const stagger = buildGoal(fb) === "stagger";
  const title = stagger ? "Modeled stagger gauge by skill" : "Estimated damage by skill";
  const values = stagger ? "Stagger gauge values" : "Damage values";
  const unit = stagger ? "gauge" : "damage";
  const names = Object.fromEntries(Object.keys(fb.result.per_skill).map(key => [key, skillName(data.gd?.skills, key)]));
  const rows = damageBreakdown(fb.result, names, 6, stagger ? "stagger" : "damage");
  if (!rows?.length) return <p className="text-sm text-dim">{stagger ? "Stagger gauge breakdown unavailable." : "Verified damage breakdown unavailable."}</p>;
  return <section aria-label={stagger ? "Stagger gauge breakdown" : "Damage breakdown"} className="build-damage">
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mb-3 text-xs text-dim">{fb.playstyle.scenario.name} · {fb.result.duration_s} s · {fb.playstyle.scenario.n_targets} targets · {fb.result.confidence}</p>
    <DamageChartBoundary key={`${fb.playstyle.key}-${unit}`}><Suspense fallback={<p className="text-xs text-dim">Loading chart. {values} remain below.</p>}><Chart rows={rows} title={title} unit={stagger ? "Gauge" : "Damage"} /></Suspense></DamageChartBoundary>
    <ul aria-label={values} className="mt-3 space-y-2 text-sm">
      {rows.map(row => <li key={row.key} className="flex flex-wrap justify-between gap-2"><span>{row.label}</span><span className="tabular-nums text-dim">{fmtDps(row.damage)} {unit} · {(row.share * 100).toFixed(1)}%</span></li>)}
    </ul>
  </section>;
}
