import { RefreshCw } from "lucide-react";
import { GameButton } from "@/components/game/GameButton";
import { OrnateCard } from "@/components/game/OrnateCard";
import { SectionTitle } from "@/components/game/SectionTitle";
import type { AdminStats, Totals } from "@/lib/analytics";
import { VisitsChart } from "./Charts";

const fmt = new Intl.NumberFormat("en-US");
const when = (ts: number) =>
  new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function Tile({ label, t }: { label: string; t: Totals }) {
  return (
    <OrnateCard size="sm" className="p-4">
      <div className="font-display text-xs font-semibold uppercase tracking-widest text-faint">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gold">{fmt.format(t.unique_visitors)}</div>
      <div className="text-xs text-dim">{fmt.format(t.page_views)} page views</div>
    </OrnateCard>
  );
}

interface Props {
  stats: AdminStats;
  onRefresh: () => void;
  onSignOut: () => void;
  busy: boolean;
}

export function AdminDashboard({ stats, onRefresh, onSignOut, busy }: Props) {
  const { totals } = stats;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <GameButton size="sm" onClick={onRefresh} disabled={busy}>
          <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
        </GameButton>
        <GameButton size="sm" variant="secondary" onClick={onSignOut}>
          Forget token
        </GameButton>
        <span className="text-xs text-faint">Updated {when(stats.generated_at)}</span>
      </div>

      <section aria-label="Visitors">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <li><Tile label="Visitors today" t={totals.today} /></li>
          <li><Tile label="Visitors 7 days" t={totals.last_7_days} /></li>
          <li><Tile label="Visitors 30 days" t={totals.last_30_days} /></li>
          <li><Tile label="Visitors all time" t={totals.all_time} /></li>
        </ul>
        <p className="mt-2 text-xs text-faint">
          Visitors are anonymous per-day ids, so the 7 day, 30 day and all-time numbers add up each day&apos;s unique visitors (someone who returns on two days counts twice).
        </p>
      </section>

      <section aria-labelledby="chart-h">
        <SectionTitle id="chart-h" caption="Gold: unique visitors. Faint blue: page views.">Visits per day</SectionTitle>
        <OrnateCard className="p-4">
          <VisitsChart days={stats.visits_per_day} />
        </OrnateCard>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="top-h">
          <SectionTitle id="top-h" caption="Lookups are per region, so an Auto (all regions) search counts up to five times.">
            Top searched characters
          </SectionTitle>
          <OrnateCard className="overflow-x-auto p-2">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5 text-right">Lookups</th>
                  <th className="px-2 py-1.5 text-right">Last searched</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_searches.map((s) => (
                  <tr key={s.keyword.toLowerCase()} className="border-t border-border-soft">
                    <td className="px-2 py-1.5 font-medium">{s.keyword}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gold">{s.count}</td>
                    <td className="px-2 py-1.5 text-right text-dim">{when(s.last_ts)}</td>
                  </tr>
                ))}
                {stats.top_searches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-dim">No searches yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </OrnateCard>
        </section>

        <section aria-labelledby="recent-h">
          <SectionTitle id="recent-h" caption="Newest first. Opened = the character the visitor clicked.">Recent searches</SectionTitle>
          <OrnateCard className="max-h-[32rem] overflow-auto p-2">
            <ul className="divide-y divide-border-soft text-sm">
              {stats.recent_searches.map((r, i) => (
                <li key={`${r.ts}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-2 py-1.5">
                  <span className="w-28 shrink-0 text-xs text-faint">{when(r.ts)}</span>
                  <strong className="font-medium">{r.keyword}</strong>
                  <span className="text-xs uppercase text-dim">{r.region}</span>
                  <span className="text-xs text-dim">{r.results} found</span>
                  {r.picked && (
                    <span className="ml-auto text-xs text-gold">
                      opened {r.picked.name}
                      {r.picked.server ? ` (${r.picked.server})` : ""}
                    </span>
                  )}
                </li>
              ))}
              {stats.recent_searches.length === 0 && <li className="px-2 py-3 text-dim">No searches yet.</li>}
            </ul>
          </OrnateCard>
        </section>
      </div>

      <section aria-labelledby="paths-h">
        <SectionTitle id="paths-h" caption="Last 30 days.">Top pages</SectionTitle>
        <OrnateCard className="p-2">
          <ul className="divide-y divide-border-soft text-sm">
            {stats.top_paths.map((p) => (
              <li key={p.path} className="flex justify-between px-2 py-1.5">
                <code className="text-dim">{p.path}</code>
                <span className="tabular-nums text-gold">{fmt.format(p.page_views)}</span>
              </li>
            ))}
            {stats.top_paths.length === 0 && <li className="px-2 py-3 text-dim">No visits yet.</li>}
          </ul>
        </OrnateCard>
      </section>
    </div>
  );
}
