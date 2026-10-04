import { Component, lazy, Suspense, type ReactNode } from "react";
import type { FullBuild } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { damageBreakdown } from "./damageBreakdown";
import { fmtDps, skillName } from "./helpers";

const Chart = lazy(() => import("@/components/ui/advanced-stats-utils/charts"));

export class DamageChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="text-xs text-dim">Chart unavailable. Damage values remain below.</p> : this.props.children; }
}

export function BuildDamage({ fb, data }: { fb: FullBuild; data: ClassData }) {
  const names = Object.fromEntries(Object.keys(fb.result.per_skill).map(key => [key, skillName(data.gd?.skills, key)]));
  const rows = damageBreakdown(fb.result, names, 6);
  if (!rows?.length) return <p className="text-sm text-dim">Verified damage breakdown unavailable.</p>;
  return <section aria-label="Damage breakdown" className="build-damage">
    <h3 className="text-base font-semibold">Estimated damage by skill</h3>
    <p className="mb-3 text-xs text-dim">{fb.playstyle.scenario.name} · {fb.result.duration_s} s · {fb.playstyle.scenario.n_targets} targets · {fb.result.confidence}</p>
    <DamageChartBoundary key={fb.playstyle.key}><Suspense fallback={<p className="text-xs text-dim">Loading chart. Damage values remain below.</p>}><Chart rows={rows} /></Suspense></DamageChartBoundary>
    <ul aria-label="Damage values" className="mt-3 space-y-2 text-sm">
      {rows.map(row => <li key={row.key} className="flex flex-wrap justify-between gap-2"><span>{row.label}</span><span className="tabular-nums text-dim">{fmtDps(row.damage)} damage · {(row.share * 100).toFixed(1)}%</span></li>)}
    </ul>
  </section>;
}
