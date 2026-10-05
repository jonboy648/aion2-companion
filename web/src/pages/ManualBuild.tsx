import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { FactionEmblem } from "@/components/game/Ornaments";
import { useCharacterFaction, type Faction } from "@/components/game/faction";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BuildResults, ProgressPanel } from "@/features/build/BuildResults";
import { ROLE_LABEL } from "@/features/build/helpers";
import { STAT_FIELDS, buildFromForm, initialForm, type ManualForm } from "@/features/build/manualBuild";
import { POINTS_DEBOUNCE_MS } from "@/features/build/unspentPoints";
import { useClassData } from "@/features/build/useClassData";
import { SkillIcon } from "@/features/codex/parts";
import { ProgressionControls } from "@/features/progression/ProgressionControls";
import { NO_EARNED_POINTS, levelBudget, prepareLevelBuild, progression, validateLevelPlan, validateLevelPriority, type EarnedPoints } from "@/features/progression/progression";
import { compare, listClasses } from "@/engine/api";
import { storePlannedBuild } from "@/features/keybinds/activeBuild";
import { useAsync } from "@/hooks/useAsync";
import type { CharacterBuild, CompareResult, FullBuild, GameData, PlaystyleKey } from "@/lib/types";

function comparisonIssues(result: CompareResult, input: CharacterBuild, budget: EarnedPoints,
  stigmaUnlocked: boolean, daevanionUnlocked: boolean, gd: GameData): string[] {
  const issues: string[] = [];
  for (const key of ["boss", "aoe", "leveling", "burst"] as const) {
    const fb = result[key];
    if (!fb || !Array.isArray(fb.variants)) {
      issues.push(`${key}: the engine did not return a complete plan.`);
      continue;
    }
    issues.push(...validateLevelPriority(fb.build, fb.priority, gd).map((issue) => `${key}: ${issue}`));
    for (const plan of [fb.build, ...fb.variants.map((variant) => variant.build)]) {
      if (plan.class_key !== input.class_key || plan.level !== input.level || plan.region !== input.region) {
        issues.push(`${key}: the engine returned a different class, level or region.`);
      }
      if (Object.keys(plan.bonus_ranks).length !== Object.keys(input.bonus_ranks).length ||
        Object.entries(plan.bonus_ranks).some(([skill, rank]) => input.bonus_ranks[skill] !== rank)) {
        issues.push(`${key}: the engine assumed unprovided bonus ranks.`);
      }
      issues.push(...validateLevelPlan(plan, budget, stigmaUnlocked, gd).map((issue) => `${key}: ${issue}`));
      if (!daevanionUnlocked && plan.daevanion_nodes.length) issues.push(`${key}: Daevanion requires its unlock quest.`);
    }
    if (!daevanionUnlocked && fb.daevanion_path.length) issues.push(`${key}: Daevanion requires its unlock quest.`);
  }
  return [...new Set(issues)];
}

/** /build?class=<key>: class picker + level/stats form -> the same playstyle results as an imported character. */
export function ManualBuild({ guideClass }: { guideClass?: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const classes = useAsync(() => listClasses(), []);
  const classKey = guideClass ?? params.get("class") ?? "sorcerer";
  const data = useClassData(classKey);
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
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{ key: string; result: CompareResult } | null>(null);
  const submitted = useRef(false);
  const run = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const inputKey = JSON.stringify({ classKey, level: form.level, stats: form.stats, earned,
    stigmaUnlocked, daevanionUnlocked, race });
  const cmp = ready && comparison?.key === inputKey ? comparison.result : null;

  function invalidate() {
    run.current++;
    window.clearTimeout(timer.current);
    setComparison(null);
    setBusy(false);
    setErrors([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitted.current = true;
    await solve();
  }

  async function solve() {
    invalidate();
    const built = buildFromForm({ ...form, classKey }, levelCap);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    const gd = data.gd;
    if (!gd || gd.class_key !== classKey) {
      setErrors(["Class progression data is not ready."]);
      return;
    }
    setBusy(true);
    setMessage("Starting...");
    const id = ++run.current;
    try {
      const prepared = prepareLevelBuild(built.build, gd, earned, stigmaUnlocked, daevanionUnlocked);
      const result = await compare(prepared.build, daevanionUnlocked ? prepared.daevanionPoints : 0,
        (m) => { if (id === run.current) setMessage(m); });
      if (id !== run.current) return;
      const spendable = { ...prepared.budget, daevanion: prepared.daevanionPoints,
        stigma: prepared.build.stigma_points ?? 0 };
      const issues = comparisonIssues(result, prepared.build, spendable, stigmaUnlocked, daevanionUnlocked, gd);
      if (issues.length) {
        setErrors(["The returned plan is not valid for these progression inputs.", ...issues]);
        return;
      }
      setComparison({ key: inputKey, result });
    } catch (err) {
      if (id === run.current) setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      if (id === run.current) setBusy(false);
    }
  }

  // Handlers revoke runs immediately; the effect also covers route/data changes.
  const solveRef = useRef(solve);
  solveRef.current = solve;
  useEffect(() => {
    invalidate();
    if (submitted.current && ready) timer.current = window.setTimeout(() => void solveRef.current(), POINTS_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer.current);
      run.current++;
    };
  }, [inputKey, data.gd]); // eslint-disable-line react-hooks/exhaustive-deps

  function usePlan(fb: FullBuild) {
    if (!cmp) return;
    storePlannedBuild(fb);
    navigate("/keybinds");
  }

  const role = classes.data?.find((c) => c.key === classKey)?.role;
  const basic = STAT_FIELDS.filter((f) => !f.advanced);
  const advanced = STAT_FIELDS.filter((f) => f.advanced);
  const previewLevel = levelBudget(Number(form.level))?.level;
  const coreSkills = Object.entries(progression.classes[classKey]?.skills ?? {}).flatMap(([key, acquisition]) => {
    const skill = data.gd?.skills[key];
    const first = acquisition.ranks.find((rank) => rank.rank === 1);
    return skill && ["active", "passive"].includes(skill.kind) && first && !first.unresolved &&
      !first.ascensionGrade && first.requires.length === 0
      ? [{ key, name: skill.name, unlockLevel: Math.max(acquisition.unlockLevel, first.characterLevel) }] : [];
  }).sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name));
  const available = previewLevel ? coreSkills.filter((skill) => skill.unlockLevel <= previewLevel) : [];
  const upcoming = previewLevel && previewLevel < levelCap ? coreSkills.filter((skill) => skill.unlockLevel === previewLevel + 1) : [];
  const skillLinks = (skills: typeof coreSkills) => skills.map((skill) => (
    <li key={skill.key}>
      <Link to={`/codex/${classKey}?skill=${encodeURIComponent(skill.key)}`} className="flex items-center gap-2 text-sm hover:text-cyan">
        <SkillIcon url={data.icons[skill.key]} name={skill.name} size={24} />
        <span>{skill.name}</span><span className="ml-auto shrink-0 text-xs text-faint">Lv {skill.unlockLevel}</span>
      </Link>
    </li>
  ));
  const setStat = (key: string, v: string) => {
    invalidate();
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: v } }));
  };

  return (
    <>
      {!guideClass && <PageHeader title="Manual build" caption="Class, level and combat stats" />}

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Class">
        {classes.data?.map((c) => (
          <Button key={c.key} size="sm" className="gap-1.5 pl-1.5" variant={c.key === classKey ? "default" : "secondary"} aria-pressed={c.key === classKey} onClick={() => {
            if (c.key === classKey) return;
            invalidate();
            if (guideClass) navigate(`/codex/${c.key}`);
            else setParams({ class: c.key });
          }}>
            <ClassEmblem classKey={c.key} size={22} />
            {c.name}
          </Button>
        ))}
        {classes.loading && <span className="text-sm text-dim">Loading classes...</span>}
        {role && <span className="self-center text-xs text-dim">{ROLE_LABEL[role]}</span>}
      </div>

      {!guideClass && <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Race">
        <span className="text-sm text-dim">Race</span>
        {(["elyos", "asmodian"] as const).map((r) => (
          <Button key={r} size="sm" className="gap-1.5 capitalize" variant={race === r ? "default" : "secondary"} aria-pressed={race === r} onClick={() => { invalidate(); setRace(race === r ? "" : r); }}>
            <FactionEmblem faction={r} size={18} />
            {r}
          </Button>
        ))}
      </div>}

      {data.error && <p role="alert" className="mb-4 text-sm text-error">Could not load class data: {data.error}</p>}

      <form onSubmit={onSubmit} noValidate>
        <ProgressionControls level={form.level} levelCap={levelCap}
          onLevel={(level) => { invalidate(); setForm((f) => ({ ...f, level })); }}
          earned={earned} onEarned={(points) => { invalidate(); setEarned(points); }}
          stigmaUnlocked={stigmaUnlocked} onStigmaUnlocked={(unlocked) => { invalidate(); setStigmaUnlocked(unlocked); }}
          daevanionUnlocked={daevanionUnlocked} onDaevanionUnlocked={(unlocked) => { invalidate(); setDaevanionUnlocked(unlocked); }} />
        {ready && previewLevel && <details className="mb-5 border-b border-border-soft pb-4">
          <summary className="cursor-pointer text-sm text-cyan">Core skills ({available.length})</summary>
          <ul aria-label={`Core skills at level ${previewLevel}`} className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {skillLinks(available)}
          </ul>
          {upcoming.length > 0 && <div className="mt-4">
            <h3 className="text-xs font-medium text-dim">At level {previewLevel + 1}</h3>
            <ul aria-label={`Core skills unlocking at level ${previewLevel + 1}`} className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {skillLinks(upcoming)}
            </ul>
          </div>}
        </details>}
        <details open={!guideClass} className="mb-5 border-b border-border-soft pb-4">
          <summary className="mb-3 cursor-pointer text-sm text-cyan">Combat stats</summary>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </details>
        {errors.length > 3 ? (
          <div role="alert" className="mt-3 text-sm text-error">
            <p>{errors[0]}</p>
            <details className="mt-2">
              <summary className="cursor-pointer">Validation details ({errors.length - 1})</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {errors.slice(1).map((error) => <li key={error}>{error}</li>)}
              </ul>
            </details>
          </div>
        ) : errors.length > 0 && (
          <ul role="alert" className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-error">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
        <div className="my-5 flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={busy || !ready}>
            {busy ? "Optimizing..." : guideClass ? "Find class build" : "Find my best build"}
          </Button>
          {!ready && !data.error && <span role="status" className="text-xs text-dim">Loading class data...</span>}
        </div>
      </form>

      {busy && <ProgressPanel title="Comparing playstyles" message={message} />}
      {cmp && !busy && <BuildResults key={inputKey} cmp={cmp} data={data} selected={selected} onSelect={setSelected} onUsePlan={usePlan} />}
    </>
  );
}
