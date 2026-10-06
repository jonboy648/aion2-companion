import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Crosshair, Layers, Sparkles, Swords, Calculator, SlidersHorizontal } from "lucide-react";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { FactionEmblem } from "@/components/game/Ornaments";
import { useCharacterFaction, type Faction } from "@/components/game/faction";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SingleBuildResults, ProgressPanel } from "@/features/build/BuildResults";
import { ROLE_LABEL } from "@/features/build/helpers";
import { STAT_FIELDS, buildFromForm, initialForm, type ManualForm } from "@/features/build/manualBuild";
import { useClassData } from "@/features/build/useClassData";
import { ProgressionControls, ProgressionSettings } from "@/features/progression/ProgressionControls";
import { GuideSkills } from "@/features/progression/GuideSkills";
import { GuideQuickslots } from "@/features/progression/GuideQuickslots";
import { GuideDaevanion } from "@/features/progression/GuideDaevanion";
import { NO_EARNED_POINTS, levelBudget, prepareLevelBuild, validateLevelPlan, validateLevelPriority, type EarnedPoints } from "@/features/progression/progression";
import { optimize, listClasses } from "@/engine/api";
import { storePlannedBuild } from "@/features/keybinds/activeBuild";
import { useAsync } from "@/hooks/useAsync";
import type { CharacterBuild, FullBuild, GameData, PlaystyleKey } from "@/lib/types";
import "@/features/progression/planner.css";

const STYLES = [
  { key: "leveling", label: "Leveling", icon: Sparkles },
  { key: "boss", label: "Boss", icon: Crosshair },
  { key: "aoe", label: "AoE", icon: Layers },
  { key: "burst", label: "Burst", icon: Swords },
] as const;

function planIssues(fb: FullBuild, input: CharacterBuild, selected: PlaystyleKey, budget: EarnedPoints,
  stigmaUnlocked: boolean, daevanionUnlocked: boolean, gd: GameData): string[] {
  if (!fb || !Array.isArray(fb.variants) || !fb.priority?.entries) return ["The engine did not return a complete plan."];
  const issues = validateLevelPriority(fb.build, fb.priority, gd);
  if (fb.playstyle.key !== selected) issues.push("The engine returned a different playstyle.");
  for (const plan of [fb.build, ...fb.variants.map((variant) => variant.build)]) {
    if (plan.class_key !== input.class_key || plan.level !== input.level || plan.region !== input.region)
      issues.push("The engine returned a different class, level or region.");
    if (Object.keys(plan.bonus_ranks).length !== Object.keys(input.bonus_ranks).length ||
      Object.entries(plan.bonus_ranks).some(([skill, rank]) => input.bonus_ranks[skill] !== rank))
      issues.push("The engine assumed unprovided bonus ranks.");
    issues.push(...validateLevelPlan(plan, budget, stigmaUnlocked, gd));
    if (!daevanionUnlocked && plan.daevanion_nodes.length) issues.push("Daevanion requires its unlock quest.");
  }
  return [...new Set(issues)];
}

/** Level previews are local; only an explicit submit requests one engine plan. */
export function ManualBuild({ guideClass }: { guideClass?: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = useId();
  const classes = useAsync(() => listClasses(), []);
  const classKey = guideClass ?? params.get("class") ?? "sorcerer";
  const data = useClassData(classKey, { staticData: true });
  const levelCap = Math.min(45, data.gd?.level_caps.global ?? 45);
  const ready = data.gd?.class_key === classKey;
  const [race, setRace] = useState<"" | Faction>("");
  useCharacterFaction(race || null);
  const [form, setForm] = useState<ManualForm>(() => ({ ...initialForm(classKey), level: "45" }));
  const [earned, setEarned] = useState<EarnedPoints>({ ...NO_EARNED_POINTS });
  const [stigmaUnlocked, setStigmaUnlocked] = useState(false);
  const [daevanionUnlocked, setDaevanionUnlocked] = useState(false);
  const [selected, setSelected] = useState<PlaystyleKey>(guideClass ? "leveling" : "boss");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<{ key: string; label: string } | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [plan, setPlan] = useState<{ id: number; key: string; gd: GameData; fb: FullBuild } | null>(null);
  const [variant, setVariant] = useState<{ id: number; value: string } | null>(null);
  const run = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const inputKey = JSON.stringify({ classKey, level: form.level, stats: form.stats, earned,
    stigmaUnlocked, daevanionUnlocked, race, selected });
  const sameClass = plan?.fb.build.class_key === classKey;
  const stale = plan?.key !== inputKey || plan?.gd !== data.gd || !ready;
  const dpsVariant = variant?.id !== plan?.id || variant?.value === "max";
  function invalidate() { run.current++; setErrors([]); }
  useEffect(() => { run.current++; }, [inputKey, data.gd]);
  useEffect(() => { setErrors([]); }, [classKey]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; run.current++; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    invalidate();
    const built = buildFromForm({ ...form, classKey }, levelCap);
    if ("errors" in built) { setErrors(built.errors); return; }
    const gd = data.gd;
    if (!gd || gd.class_key !== classKey) { setErrors(["Class progression data is not ready."]); return; }
    const id = ++run.current;
    inFlight.current = true;
    setBusy(true);
    setRunning({ key: inputKey, label: STYLES.find((style) => style.key === selected)!.label });
    setMessage("Starting...");
    try {
      const prepared = prepareLevelBuild(built.build, gd, earned, stigmaUnlocked, daevanionUnlocked);
      const result = await optimize(prepared.build, selected, prepared.daevanionPoints,
        (m) => { if (id === run.current) setMessage(m); });
      if (id !== run.current) return;
      const spendable = { ...prepared.budget, daevanion: prepared.daevanionPoints,
        stigma: prepared.build.stigma_points ?? 0 };
      const issues = planIssues(result, prepared.build, selected, spendable, stigmaUnlocked, daevanionUnlocked, gd);
      if (issues.length) { setErrors(["The returned plan is not valid for these progression inputs.", ...issues]); return; }
      setPlan({ id, key: inputKey, gd, fb: result });
      setVariant(null);
    } catch (err) {
      if (id === run.current) setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const usePlan = (fb: FullBuild) => {
    if (stale || busy) return;
    storePlannedBuild(fb);
    navigate("/keybinds");
  };
  const info = classes.data?.find((c) => c.key === classKey);
  const IdentityHeading = guideClass ? "h1" : "h2";
  const previewLevel = levelBudget(Number(form.level))?.level;
  const settings = { level: form.level, levelCap,
    onLevel: (level: string) => { invalidate(); setForm((f) => ({ ...f, level })); },
    earned, onEarned: (points: EarnedPoints) => { invalidate(); setEarned(points); },
    stigmaUnlocked, onStigmaUnlocked: (unlocked: boolean) => { invalidate(); setStigmaUnlocked(unlocked); },
    daevanionUnlocked, onDaevanionUnlocked: (unlocked: boolean) => { invalidate(); setDaevanionUnlocked(unlocked); } };
  const statField = (f: typeof STAT_FIELDS[number]) => (
    <label key={f.key} className="block text-sm">
      <span className="mb-1 block text-dim">{f.label}</span>
      <Input type="number" inputMode="decimal" step={f.step} min={0} value={form.stats[f.key]} onChange={(e) => {
        invalidate(); setForm((old) => ({ ...old, stats: { ...old.stats, [f.key]: e.target.value } }));
      }} />
    </label>
  );
  return (
    <div className="level-planner reference-guide">
      {!guideClass && <PageHeader title="Manual build" caption="Your class, level and build plan" />}
      <div className="planner-class-picker" role="group" aria-label="Class">
        {classes.data?.map((c) => <button type="button" key={c.key} aria-pressed={c.key === classKey}
          onClick={() => {
            if (c.key === classKey) return;
            invalidate();
            if (guideClass) navigate("/codex/" + c.key);
            else setParams({ class: c.key });
          }}><ClassEmblem classKey={c.key} size={28} /><span>{c.name}</span></button>)}
        {classes.loading && <span role="status" className="text-sm text-dim">Loading classes...</span>}
      </div>
      <header className="planner-identity">
        {info && <img src={import.meta.env.BASE_URL + "brand/classes/" + info.key + "-320.webp"} alt="" width={88} height={88} />}
        <div><IdentityHeading>{info?.name ?? classKey} {guideClass ? "class guide" : "build"}</IdentityHeading>
          <p>{info?.role && ROLE_LABEL[info.role]}<span className="mx-2 text-faint">/</span>Global</p></div>
        <span className="planner-level-label">Level {previewLevel ?? "-"}</span>
      </header>
      <ProgressionControls {...settings} compact />
      <div className="planner-toolbar">
        <div role="group" aria-label="Playstyle" className="planner-playstyles">
          {STYLES.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-pressed={selected === key}
            onClick={() => { invalidate(); setSelected(key); }}><Icon size={16} aria-hidden /><span>{label}</span></button>)}
        </div>
        <Button type="submit" form={formId} disabled={busy || !ready}><Calculator aria-hidden />{busy ? "Calculating..." : "Calculate plan"}</Button>
      </div>
      {data.error && <p role="alert" className="my-4 text-sm text-error">Could not load class data: {data.error}</p>}
      {!ready && !data.error && <p role="status" className="my-4 text-sm text-dim">Loading class data...</p>}
      <form id={formId} onSubmit={onSubmit} noValidate className="planner-settings">
        <div className="planner-settings-section"><h2><SlidersHorizontal size={16} aria-hidden />Unlocked systems</h2><ProgressionSettings {...settings} /></div>
        <div className="planner-settings-section"><h2>Combat stats</h2>
          <div className="grid grid-cols-2 gap-3">{STAT_FIELDS.filter((f) => ["attack", "max_mp"].includes(f.key)).map(statField)}</div>
          <details className="mt-3"><summary>More combat stats</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">{STAT_FIELDS.filter((f) => !["attack", "max_mp"].includes(f.key)).map(statField)}</div></details>
        </div>
        {!guideClass && <div className="planner-settings-section" role="group" aria-label="Race"><h2>Faction</h2>
          <div className="flex flex-wrap gap-2">{(["elyos", "asmodian"] as const).map((r) => <Button key={r} type="button" size="sm" className="gap-1.5 capitalize"
            variant={race === r ? "default" : "secondary"} aria-pressed={race === r} onClick={() => { invalidate(); setRace(race === r ? "" : r); }}>
            <FactionEmblem faction={r} size={18} />{r}</Button>)}</div>
        </div>}
      </form>
      {busy && <div className="planner-progress">
          <ProgressPanel title={running?.key !== inputKey ? "Finishing previous calculation" : "Calculating " + running.label + " plan"} message={message} />
          {running?.key !== inputKey && <p className="mt-2 text-xs text-dim">Inputs changed. Calculate again once this search finishes.</p>}
      </div>}
      {errors.length > 0 && <div role="alert" className="planner-errors">
          <p>{errors[0]}</p>
          {errors.length > 1 && <details><summary>Validation details ({errors.length - 1})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">{errors.slice(1).map((error) => <li key={error}>{error}</li>)}</ul></details>}
      </div>}
      <section aria-label="Progression plan" className="guide-reference-grid">
        {ready && previewLevel && data.gd && <GuideDaevanion gd={data.gd} icons={data.icons} level={previewLevel}
          unlocked={daevanionUnlocked} build={plan && sameClass && !stale && !busy && dpsVariant ? plan.fb.build : undefined}
          path={plan && sameClass && !stale && !busy && dpsVariant ? plan.fb.daevanion_path : undefined} />}
        <div className="planner-main">
          {ready && previewLevel && data.gd && <GuideSkills gd={data.gd} icons={data.icons} level={previewLevel}
            plannedBuild={plan && sameClass && !stale && !busy && dpsVariant ? plan.fb.build : undefined} />}
        </div>
      </section>
      {plan && sameClass ? <div className="planner-slot-column">
          <div className="planner-plan-heading"><h2>{plan.fb.playstyle.name} / Level {plan.fb.build.level}</h2>
            {(stale || busy) && <span role="status">Out of date</span>}</div>
          {(stale || busy) && <p className="mb-4 text-sm text-dim">Previous plan. Recalculate for the current inputs before using it.</p>}
          {!dpsVariant && <p className="mb-4 text-sm text-dim">Select the DPS arrangement to use its quickslots and macro.</p>}
          <GuideQuickslots fb={plan.fb} data={data} disabled={stale || busy || !dpsVariant} />
        </div> : <section aria-label="Quickslots and macro" className="planner-empty-plan">
          <h2>Quickslots &amp; Macro</h2>
          <p>No calculated plan</p>
        </section>}
      {plan && sameClass && <section aria-label="Calculated build plan" className="planner-analysis">
          <h2 className="planner-analysis-title">Build analysis <span>{plan.fb.playstyle.name} / Level {plan.fb.build.level}</span></h2>
          <div>
            <SingleBuildResults key={plan.id} fb={plan.fb} data={data} onUsePlan={usePlan} disabled={stale || busy}
              onVariantChange={(value) => setVariant({ id: plan.id, value })} />
          </div>
      </section>}
    </div>
  );
}
