import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { FactionEmblem } from "@/components/game/Ornaments";
import { useCharacterFaction, type Faction } from "@/components/game/faction";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BuildResults, ProgressPanel } from "@/features/build/BuildResults";
import { ROLE_LABEL } from "@/features/build/helpers";
import { STAT_FIELDS, buildFromForm, initialForm, type ManualForm } from "@/features/build/manualBuild";
import { UnspentPoints } from "@/features/build/UnspentPointsInput";
import { applyPoints, POINTS_DEBOUNCE_MS, usePoints } from "@/features/build/unspentPoints";
import { useClassData } from "@/features/build/useClassData";
import { cn } from "@/lib/utils";
import { compare, listClasses } from "@/engine/api";
import { storeActiveBuild } from "@/features/keybinds/activeBuild";
import { useAsync } from "@/hooks/useAsync";
import type { CompareResult } from "@/lib/types";

const FALLBACK_LEVEL_CAP = 65;

/** /build?class=<key>: class picker + level/stats form -> the same playstyle results as an imported character. */
export function ManualBuild() {
  const [params, setParams] = useSearchParams();
  const classes = useAsync(() => listClasses(), []);
  const classKey = params.get("class") ?? "sorcerer";
  const data = useClassData(classKey);
  const levelCap = data.gd?.level_caps.global ?? FALLBACK_LEVEL_CAP;

  const [race, setRace] = useState<"" | Faction>("");
  useCharacterFaction(race || null);
  const [form, setForm] = useState<ManualForm>(() => initialForm(classKey));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [resultClass, setResultClass] = useState(classKey);
  const [points, setPoints] = usePoints("aion2c:unspent:manual");
  const solvedPoints = useRef("");
  const run = useRef(0);
  const levelEdited = useRef(false);

  // default the level to the cap once it is known, unless the user already typed one
  useEffect(() => {
    if (!levelEdited.current) setForm((f) => (f.level === String(levelCap) ? f : { ...f, level: String(levelCap) }));
  }, [levelCap]);

  // changing class (URL is the source of truth, so links and the picker agree) invalidates old results
  useEffect(() => {
    setForm((f) => (f.classKey === classKey ? f : { ...f, classKey }));
    setCmp(null);
    setErrors([]);
    run.current++;
    setBusy(false);
  }, [classKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await solve();
  }

  async function solve() {
    const built = buildFromForm(form, levelCap);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    const build = applyPoints(built.build, points);
    solvedPoints.current = `${points.skill}|${points.stigma}`;
    setErrors([]);
    setBusy(true);
    setCmp(null);
    setMessage("Starting...");
    const id = ++run.current;
    try {
      storeActiveBuild(build);
      const result = await compare(build, null, (m) => id === run.current && setMessage(m));
      if (id !== run.current) return;
      setCmp(result);
      setResultClass(form.classKey);
    } catch (err) {
      if (id === run.current) setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      if (id === run.current) setBusy(false);
    }
  }

  // changing the points re-runs an existing result (debounced); the first run is the submit button
  const solveRef = useRef(solve);
  solveRef.current = solve;
  useEffect(() => {
    if (!cmp || `${points.skill}|${points.stigma}` === solvedPoints.current) return;
    const t = window.setTimeout(() => void solveRef.current(), POINTS_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [points.skill, points.stigma]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = classes.data?.find((c) => c.key === classKey)?.role;
  const basic = STAT_FIELDS.filter((f) => !f.advanced);
  const advanced = STAT_FIELDS.filter((f) => f.advanced);
  const setStat = (key: string, v: string) => setForm((f) => ({ ...f, stats: { ...f.stats, [key]: v } }));

  return (
    <>
      <PageHeader title="Manual build" caption="Class, level and combat stats" />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Class">
        {classes.data?.map((c) => (
          <Button key={c.key} size="sm" className="gap-1.5 pl-1.5" variant={c.key === classKey ? "default" : "secondary"} aria-pressed={c.key === classKey} onClick={() => setParams({ class: c.key })}>
            <ClassEmblem classKey={c.key} size={22} />
            {c.name}
          </Button>
        ))}
        {classes.loading && <span className="text-sm text-dim">Loading classes...</span>}
        {role && <span className="self-center text-xs text-dim">{ROLE_LABEL[role]}</span>}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Race">
        <span className="text-sm text-dim">Race (sets the colour theme)</span>
        {(["elyos", "asmodian"] as const).map((r) => (
          <Button key={r} size="sm" className="gap-1.5 capitalize" variant={race === r ? "default" : "secondary"} aria-pressed={race === r} onClick={() => setRace(race === r ? "" : r)}>
            <FactionEmblem faction={r} size={18} />
            {r}
          </Button>
        ))}
      </div>

      <form onSubmit={onSubmit} noValidate>
        <details open={!cmp || busy} className="mb-4">
          <summary className="mb-3 cursor-pointer text-sm text-cyan">Build inputs</summary>
        <Card className="mb-4 rounded-lg">
          <CardHeader>
            <CardTitle>Level and stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm">
                <span className="mb-1 block text-dim">Level (1 to {levelCap})</span>
                <Input inputMode="numeric" value={form.level} onChange={(e) => {
                    levelEdited.current = true;
                    setForm((f) => ({ ...f, level: e.target.value }));
                  }}
                />
              </label>
              {basic.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="mb-1 block text-dim">{f.label}</span>
                  <Input type="number" inputMode="decimal" step={f.step} min={0} value={form.stats[f.key]} onChange={(e) => setStat(f.key, e.target.value)} />
                </label>
              ))}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-cyan">More stats</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {advanced.map((f) => (
                  <label key={f.key} className="block text-sm">
                    <span className="mb-1 block text-dim">{f.label}</span>
                    <Input type="number" inputMode="decimal" step={f.step} min={0} value={form.stats[f.key]} onChange={(e) => setStat(f.key, e.target.value)} />
                  </label>
                ))}
              </div>
            </details>
            <div className="mt-4">
              <UnspentPoints value={points} onChange={setPoints} />
            </div>
            {errors.length > 0 && (
              <ul role="alert" className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-error">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Optimizing..." : "Find my best build"}
              </Button>
              <span className={cn("text-xs text-faint")}>Skill ranks and Daevanion are not entered here: the optimizer assumes a typical spread.</span>
            </div>
          </CardContent>
        </Card>
        </details>
      </form>

      {busy && <ProgressPanel title="Comparing playstyles" message={message} />}
      {cmp && !busy && <BuildResults key={`${resultClass}-${cmp.boss?.result.dps ?? 0}`} cmp={cmp} data={data} />}
    </>
  );
}
