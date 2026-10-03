import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { roadmap } from "@/engine/api";
import { ClassSelect } from "@/features/keybinds/ClassSelect";
import { useToolsClass } from "@/features/keybinds/useToolsClass";
import { Timeline } from "@/features/roadmap/Timeline";
import { groupByLevel, KIND_LABEL, progress } from "@/features/roadmap/levels";
import type { Region, RoadmapItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS = Object.keys(KIND_LABEL) as RoadmapItem["kind"][];
const REGIONS: { key: Region; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "korea", label: "Korea" },
];

export function RoadmapPage() {
  const tc = useToolsClass();
  const build = tc.build && tc.build.class_key === tc.classKey ? tc.build : null;
  const [region, setRegion] = useState<Region>("global");
  const [level, setLevel] = useState<number>(1);
  const [kinds, setKinds] = useState<Set<RoadmapItem["kind"]>>(new Set(KINDS));
  const [items, setItems] = useState<RoadmapItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // follow the character the first time one shows up; the visitor can still override both
  const buildLevel = build?.level;
  const buildRegion = build?.region;
  useEffect(() => {
    if (buildLevel != null) setLevel(buildLevel);
  }, [buildLevel]);
  useEffect(() => {
    if (buildRegion) setRegion(buildRegion);
  }, [buildRegion]);

  useEffect(() => {
    if (!tc.classKey) return;
    let live = true;
    setItems(null);
    setError(null);
    roadmap(tc.classKey, region, build).then(
      (r) => live && setItems(r),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
    // build identity only matters through its show_kr flag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc.classKey, region, build?.show_kr]);

  const cap = useMemo(() => (items?.length ? Math.max(...items.map((i) => i.level)) : 50), [items]);
  const shown = useMemo(() => (items ?? []).filter((i) => kinds.has(i.kind)), [items, kinds]);
  const groups = useMemo(() => groupByLevel(shown), [shown]);
  const prog = useMemo(() => progress(items ?? [], level), [items, level]);
  const err = tc.error ?? error;
  const toggleKind = (k: RoadmapItem["kind"]) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size === 0 ? new Set(KINDS) : next;
    });

  return (
    <>
      <PageHeader title="Road map" caption="What unlocks at each level, with your current stretch highlighted.">
        <div className="flex flex-wrap items-center gap-3">
          <ClassSelect classes={tc.classes} value={tc.classKey} onChange={tc.setClassKey} />
          <label className="flex items-center gap-2 text-xs text-dim">
            Your level
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={cap}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(cap, Math.floor(Number(e.target.value) || 1))))}
              className="h-9 w-20 rounded-md border border-border bg-surface2 px-2.5 text-sm text-foreground outline-none focus:border-gold"
            />
          </label>
          <div role="group" aria-label="Region" className="inline-flex rounded-md border border-border p-0.5 text-sm">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={region === r.key}
                onClick={() => setRegion(r.key)}
                className={cn("rounded px-3 py-1 transition-colors", region === r.key ? "bg-surface3 text-gold" : "text-dim hover:text-foreground")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {err && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-error/40 bg-error/10 px-3.5 py-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
          <div>
            <p className="font-medium">Could not load the road map.</p>
            <p className="text-xs text-dim">{err}</p>
          </div>
        </div>
      )}

      {items && (
        <Card className="mb-5">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {build && <Badge tone="gold">{build.name}</Badge>}
              <Badge>Level {level} of {cap}</Badge>
              <Badge tone="ok">
                {prog.unlocked} of {prog.total} unlocked
              </Badge>
              {prog.nextLevel != null ? (
                <Badge tone="info">
                  Next at level {prog.nextLevel} ({prog.levelsToNext} level{prog.levelsToNext === 1 ? "" : "s"} away)
                </Badge>
              ) : (
                <Badge tone="gold">Everything unlocked</Badge>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Level progress"
              aria-valuemin={1}
              aria-valuemax={cap}
              aria-valuenow={level}
              className="h-2.5 overflow-hidden rounded-full bg-surface3"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi" style={{ width: `${(Math.min(level, cap) / cap) * 100}%` }} />
            </div>
            <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5 pt-1">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kinds.has(k)}
                  onClick={() => toggleKind(k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    kinds.has(k) ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface2 text-faint hover:text-foreground",
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!items && !err && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading road map">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border-soft bg-surface" />
          ))}
        </div>
      )}
      {items && groups.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-dim">Nothing to show for this class and region yet.</p>
      )}
      {groups.length > 0 && <Timeline groups={groups} level={level} />}
    </>
  );
}

export default RoadmapPage;
