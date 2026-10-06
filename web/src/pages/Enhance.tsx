import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gradeColor } from "@/features/crafting/useCrafting";
import {
  SLOT_LABEL,
  TRACKS,
  firstRiskyLevel,
  fmt,
  loadEnhance,
  rerollFor,
  searchItems,
  stepsFor,
  toItem,
  type EnhItem,
  type EnhanceDoc,
  type TrackKey,
} from "@/features/enhance/enhanceData";
import { attemptsCdf, attemptsPercentile, chanceWithin, costPercentiles, plan, successAt, type CostSpread } from "@/features/enhance/enhanceMath";
import { cn } from "@/lib/utils";

const CdfChart = lazy(() => import("@/features/enhance/CdfChart"));

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="text-xs text-dim">The chart could not load. The numbers above are complete.</p> : this.props.children;
  }
}

const DEFAULT_ITEM = 110120003; // Ludra's Blade of Extinction, Unique IL 102: the item the community benchmarks use
const pct = (x: number) => (x >= 0.9995 ? "100%" : x < 0.0005 ? "<0.1%" : `${(x * 100).toFixed(x < 0.1 ? 2 : 1)}%`);
const matList = (m: Record<string, number>) => Object.entries(m).filter(([, n]) => n > 0);

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="frame min-w-0 p-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums text-gold sm:text-2xl">{value}</p>
      {sub && <p className="text-xs text-dim">{sub}</p>}
    </div>
  );
}

function Pick({ label, value, onChange, children }: { label: string; value: string | number; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-dim">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 game-input px-2.5 text-sm text-foreground">
        {children}
      </select>
    </label>
  );
}

export function EnhancePage() {
  const [doc, setDoc] = useState<EnhanceDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sp, setSp] = useSearchParams();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [il, setIl] = useState("");
  const [slot, setSlot] = useState("");
  const [tries, setTries] = useState(10);

  useEffect(() => {
    loadEnhance().then(setDoc, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const items = useMemo(() => (doc ? doc.items.map(toItem) : []), [doc]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const item: EnhItem | null = byId.get(Number(sp.get("item") ?? DEFAULT_ITEM)) ?? items[0] ?? null;
  const available = item ? TRACKS.filter((t) => item.groups[t.key]) : [];
  const trackKey = (available.find((t) => t.key === sp.get("track"))?.key ?? available[0]?.key ?? "enchant") as TrackKey;
  const track = TRACKS.find((t) => t.key === trackKey)!;
  const group = item?.groups[trackKey] ?? null;
  const steps = useMemo(() => (doc ? stepsFor(doc, trackKey, group) : null), [doc, trackKey, group]);
  const maxLevel = steps?.length ?? 0;
  const clamp = (n: number) => Math.max(0, Math.min(maxLevel, Number.isFinite(n) ? Math.floor(n) : 0));
  const dFrom = steps ? firstRiskyLevel(steps) : 0;
  const from = clamp(sp.has("from") ? Number(sp.get("from")) : dFrom);
  const to = Math.max(from, clamp(sp.has("to") ? Number(sp.get("to")) : maxLevel));
  const pity = sp.get("pity") !== "0";

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v === null ? next.delete(k) : next.set(k, v);
    setSp(next, { replace: true });
  };
  const choose = (i: EnhItem) => {
    setSp(new URLSearchParams({ item: String(i.id) }), { replace: true });
    setQuery("");
  };

  const calc = useMemo(() => {
    if (!steps || to <= from) return null;
    const p = plan(steps, from, to, { pity });
    if (!p.feasible) return { p, feasible: false as const };
    const cdf = attemptsCdf(steps, from, to, { pity });
    const spread: Record<string, CostSpread> = { kinah: costPercentiles(steps, from, to, (s) => s.kinah, { pity }) };
    for (const [name] of matList(p.mats)) spread[name] = costPercentiles(steps, from, to, (s) => s.mats[name] ?? 0, { pity });
    return { p, feasible: true as const, cdf, median: attemptsPercentile(cdf, 0.5), p90: attemptsPercentile(cdf, 0.9), spread };
  }, [steps, from, to, pity]);

  const results = query ? searchItems(items, query) : [];
  const grades = [...new Set(items.map((i) => i.grade))];
  const ils = [...new Set(items.filter((i) => i.grade === grade).map((i) => i.il))].sort((a, b) => a - b);
  const slots = [...new Set(items.filter((i) => i.grade === grade && String(i.il) === il).map((i) => i.slot))];
  const browse = grade && il && slot ? items.filter((i) => i.grade === grade && String(i.il) === il && i.slot === slot).slice(0, 12) : [];
  const levels = Array.from({ length: maxLevel + 1 }, (_, n) => n);
  const hasDrop = !!steps?.some((s) => s.drop > 0);
  const reroll = track.key === "soulbind" ? rerollFor(doc!, group) : null;
  const unit = (n: number) => track.level(n);

  return (
    <>
      <PageHeader title="Enhancement calculator" caption="Expected attempts, kinah and materials to take a piece of gear from one level to another, with pity and level drops worked out exactly." />

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-error/40 bg-error/10 px-3.5 py-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
          <div>
            <p className="font-medium">Could not load the enhancement tables.</p>
            <p className="text-xs text-dim">{error}</p>
          </div>
        </div>
      )}
      {!doc && !error && <div className="h-40 animate-pulse ornate" aria-busy="true" aria-label="Loading enhancement tables" />}

      {doc && item && steps && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle>Item</CardTitle>
              <CardDescription>Search by name, or pick a grade, item level and slot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex flex-col gap-1 text-xs text-dim">
                Search items
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Ludra, Unique ring" className="h-9 game-input px-2.5 text-sm text-foreground" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Pick label="Grade" value={grade} onChange={(v) => { setGrade(v); setIl(""); setSlot(""); }}>
                  <option value="">--</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </Pick>
                <Pick label="Item level" value={il} onChange={(v) => { setIl(v); setSlot(""); }}>
                  <option value="">--</option>
                  {ils.map((n) => <option key={n} value={n}>{n}</option>)}
                </Pick>
                <Pick label="Slot" value={slot} onChange={setSlot}>
                  <option value="">--</option>
                  {slots.map((s) => <option key={s} value={s}>{SLOT_LABEL[s] ?? s}</option>)}
                </Pick>
              </div>
              {(results.length > 0 || browse.length > 0) && (
                <ul aria-label="Matching items" className="max-h-64 space-y-1 overflow-y-auto">
                  {(results.length ? results : browse).map((i) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => choose(i)} className="frame flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-surface2">
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: gradeColor(i.grade) }} />
                        <span className="min-w-0 flex-1 truncate">{i.name}</span>
                        <span className="shrink-0 text-xs text-dim">IL {i.il} {SLOT_LABEL[i.slot] ?? i.slot}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query && results.length === 0 && <p className="text-xs text-dim">No item matches.</p>}

              <div className="frame p-3">
                <p className="flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: gradeColor(item.grade) }} />
                  <span className="min-w-0 truncate">{item.name}</span>
                </p>
                <p className="text-xs text-dim">{item.grade} · item level {item.il} · {SLOT_LABEL[item.slot] ?? item.slot}</p>
              </div>

              <div role="group" aria-label="Upgrade type" className="flex flex-wrap gap-1.5">
                {available.map((t) => (
                  <button key={t.key} type="button" aria-pressed={t.key === trackKey} onClick={() => set({ track: t.key, from: null, to: null })}
                    className={cn("h-8 rounded-md border px-3 text-xs", t.key === trackKey ? "border-gold bg-gold/15 text-gold" : "border-border text-dim hover:text-foreground")}>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-dim">{track.blurb}</p>

              <div className="grid grid-cols-2 gap-2">
                <Pick label="Current level" value={from} onChange={(v) => set({ from: v })}>
                  {levels.slice(0, maxLevel).map((n) => <option key={n} value={n}>{unit(n)}</option>)}
                </Pick>
                <Pick label="Target level" value={to} onChange={(v) => set({ to: v })}>
                  {levels.slice(1).map((n) => <option key={n} value={n}>{unit(n)}</option>)}
                </Pick>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={pity} onChange={(e) => set({ pity: e.target.checked ? null : "0" })} />
                <span>
                  Count the pity bonus
                  <span className="block text-xs text-dim">Each failure in a row adds to the next try&apos;s odds until the level changes. Off shows the plain odds.</span>
                </span>
              </label>
              <p className="text-xs text-dim">
                The game tables hold no protection item or scroll for this: a failed enhance leaves gear where it was
                {hasDrop ? ", except on this item, which loses a level on every failure (included below)." : "; only the Clash Rune loses a level."}
              </p>
            </CardContent>
          </Card>

          <section aria-label="Result" className="min-w-0 space-y-5">
            {to <= from || !calc ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-dim">Pick a target level above the current one.</p>
            ) : !calc.feasible ? (
              <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-4 text-sm">A step in this range has no chance of success in the data, so it can never finish.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Tile label="Expected attempts" value={fmt(calc.p.attempts)} sub={`${unit(from)} to ${unit(to)}`} />
                  <Tile label="Expected kinah" value={fmt(calc.p.kinah)} sub={`${Math.round(calc.p.kinah).toLocaleString("en-US")} kinah`} />
                  {matList(calc.p.mats).map(([name, n]) => <Tile key={name} label={name} value={fmt(n)} sub="expected materials" />)}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Average, median and unlucky</CardTitle>
                    <CardDescription>
                      Half of all runs finish at or under the median; 9 in 10 finish at or under the 90% column.
                      {calc.spread.kinah.method === "simulated" && ` The median and 90% of an item that loses levels come from a simulation of ${calc.spread.kinah.runs.toLocaleString("en-US")} runs, so they wobble by a few percent; the average is exact.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-sm tabular-nums">
                      <thead className="text-left text-xs text-dim">
                        <tr><th className="py-1 pr-3 font-normal"><span className="sr-only">Measure</span></th><th className="px-2 text-right font-normal">Average</th><th className="px-2 text-right font-normal">Median</th><th className="pl-2 text-right font-normal">90%</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row" className="py-1 pr-3 text-left font-normal">Attempts</th>
                          <td className="px-2 text-right">{fmt(calc.p.attempts)}</td>
                          <td className="px-2 text-right">{calc.median ?? "more"}</td>
                          <td className="pl-2 text-right">{calc.p90 ?? "more"}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="py-1 pr-3 text-left font-normal">Kinah</th>
                          <td className="px-2 text-right">{fmt(calc.p.kinah)}</td>
                          <td className="px-2 text-right">{calc.spread.kinah.median === null ? "more" : fmt(calc.spread.kinah.median)}</td>
                          <td className="pl-2 text-right">{calc.spread.kinah.p90 === null ? "more" : fmt(calc.spread.kinah.p90)}</td>
                        </tr>
                        {matList(calc.p.mats).map(([name, n]) => (
                          <tr key={name}>
                            <th scope="row" className="py-1 pr-3 text-left font-normal">{name}</th>
                            <td className="px-2 text-right">{fmt(n)}</td>
                            <td className="px-2 text-right">{calc.spread[name].median === null ? "more" : fmt(calc.spread[name].median!)}</td>
                            <td className="pl-2 text-right">{calc.spread[name].p90 === null ? "more" : fmt(calc.spread[name].p90!)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {calc.cdf.truncated && <p className="mt-2 text-xs text-dim">Some runs are so long that the tail is cut off after {calc.cdf.cdf.length - 1} attempts.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Chance to finish within N tries</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-dim">
                        Tries
                        <input type="number" inputMode="numeric" min={1} max={100000} value={tries} aria-label="Number of tries"
                          onChange={(e) => setTries(Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1))))}
                          className="h-9 w-24 game-input px-2.5 text-sm text-foreground" />
                      </label>
                      <p className="font-display text-2xl font-bold tabular-nums text-gold" data-testid="within">{pct(chanceWithin(calc.cdf, tries))}</p>
                      <p className="text-sm text-dim">chance to be done in {tries} {tries === 1 ? "try" : "tries"}</p>
                    </div>
                    <ChartBoundary>
                      <Suspense fallback={<p className="text-xs text-dim">Loading chart. The numbers above are complete.</p>}>
                        <CdfChart cdf={calc.cdf} median={calc.median} p90={calc.p90} />
                      </Suspense>
                    </ChartBoundary>
                    <p className="text-xs text-dim">Dashed lines: median (grey) and 90% (gold).</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Step by step</CardTitle>
                    <CardDescription>Odds and price of one attempt at each level, and what you should expect to spend there.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[25rem] text-sm tabular-nums" data-testid="steps">
                      <thead className="text-left text-xs text-dim">
                        <tr>
                          <th className="py-1 pr-2 font-normal">Step</th>
                          <th className="px-2 text-right font-normal">Odds</th>
                          <th className="px-2 text-right font-normal">Per try</th>
                          <th className="px-2 text-right font-normal">Tries</th>
                          <th className="pl-2 text-right font-normal">Kinah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.p.perLevel.map((r) => {
                          const s = steps[r.level];
                          return (
                            <tr key={r.level} className="border-t border-border/50 align-top">
                              <th scope="row" className="py-1 pr-2 text-left font-normal">{unit(r.level)} to {unit(r.level + 1)}{s.drop > 0 && <span className="block text-[11px] text-warn">fail: -{s.drop} level</span>}</th>
                              <td className="px-2 text-right">{pct(s.p)}{s.fc > 0 && <span className="block text-[11px] text-dim">{pity ? `+${(s.fc * 100).toFixed(0)}% per fail, up to ${pct(successAt(s, 99))}` : "pity off"}</span>}</td>
                              <td className="px-2 text-right">{fmt(s.kinah)}{matList(s.mats).map(([n, c]) => <span key={n} className="block text-[11px] text-dim">{c.toLocaleString("en-US")} {n}</span>)}</td>
                              <td className="px-2 text-right">{fmt(r.attempts)}</td>
                              <td className="pl-2 text-right">{fmt(r.kinah)}{matList(r.mats).map(([n, c]) => <span key={n} className="block text-[11px] text-dim">{fmt(c)} {n}</span>)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reroll && <p className="mt-2 text-xs text-dim">A reset (new binding) costs {fmt(reroll.kinah)} kinah and {matList(reroll.mats).map(([n, c]) => `${c} ${n}`).join(", ")}.</p>}
                  </CardContent>
                </Card>
              </>
            )}
            <p className="text-xs text-dim">
              Odds, pity and prices are read from the game client tables. The pity rule (bonus added per consecutive failure, capped at 100%, restarting when the level changes) is how the data is
              commonly read; the tables do not spell it out, so check it in game against your own streaks.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
