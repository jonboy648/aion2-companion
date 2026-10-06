import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassData } from "@/features/build/useClassData";
import { hashBuild, MACRO_SCENARIOS, type MacroScenario, type PlannedBuild } from "@/features/keybinds/activeBuild";
import { Hotbar } from "@/features/keybinds/Hotbar";
import { MACRO_META, MacroPanel } from "@/features/keybinds/MacroPanel";
import { SkillIcon } from "@/features/keybinds/SkillIcon";
import { useKeybindPlan } from "@/features/keybinds/useKeybindPlan";
import type { FullBuild } from "@/lib/types";
import "./guide-quickslots.css";
import { guideRanks } from "./guideRanks";

type Props = { fb: FullBuild; data: ClassData; disabled?: boolean };

export function GuideQuickslots(props: Props) {
  const scenario = props.fb.playstyle.scenario.key;
  if (!MACRO_SCENARIOS.includes(scenario as MacroScenario)) {
    return (
      <section aria-label="Quickslots" className="guide-quickslots min-w-0 space-y-3">
        <h2 className="text-base font-semibold">Quickslots</h2>
        <p className="text-sm text-dim">Macros are not modeled for this playstyle yet.</p>
      </section>
    );
  }
  return <SupportedQuickslots {...props} />;
}

function SupportedQuickslots({ fb, data, disabled = false }: Props) {
  const { build, planned } = useMemo(() => {
    const build = { ...fb.build, skill_points: 0, stigma_points: 0 };
    const planned: PlannedBuild = {
      buildHash: hashBuild(build),
      playstyle: fb.playstyle.key,
      scenario: fb.playstyle.scenario.key as MacroScenario,
      priority: fb.priority,
    };
    return { build, planned };
  }, [fb]);
  const kb = useKeybindPlan(build, planned);
  const [selected, setSelected] = useState("1");
  const [inspecting, setInspecting] = useState(false);
  const error = kb.planError ?? (kb.phase.status === "error" ? kb.phase.message : null);
  const plan = kb.phase.status === "ready" && !error ? kb.result?.plan : undefined;
  const gd = kb.gd ?? data.gd;
  const icons = { ...data.icons, ...kb.icons };
  const stack = plan?.stacks.find((s) => s.key_label === selected)?.stack
    ?? (kb.pins[selected] ? [kb.pins[selected]] : []);
  const macroPlan = plan ? {
    ...plan,
    macros: plan.macros.filter((m) => MACRO_META[m.name as keyof typeof MACRO_META]?.scenario === planned.scenario),
  } : null;
  const ranks = gd ? guideRanks(gd, fb.build) : {};

  return (
    <section aria-label="Quickslots and macro" aria-disabled={disabled} inert={disabled} className="guide-quickslots min-w-0">
      <fieldset disabled={disabled} className="guide-quickslots-sections min-w-0 border-0 p-0">
        <section aria-label="Quickslots" className="reference-panel guide-slot-panel">
          <h2 className="reference-panel-heading">Quick Slots</h2>
          <div className="reference-panel-body">
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-error">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <p className="min-w-0 flex-1 break-words">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => { if (!disabled) kb.rerun(); }}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            </div>
          ) : !plan ? (
            <div role="status" aria-busy="true" className="flex items-start gap-2 text-sm text-dim">
              <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
              <div>
                <p>Building quickslots</p>
                {kb.phase.status === "loading" && <p className="text-xs">{kb.phase.message}</p>}
              </div>
            </div>
          ) : (
            <>
              <Hotbar
                compact
                ranks={ranks}
                manualSkills={Object.keys(plan.manual_every_s)}
                macroKeys={macroPlan?.macros.flatMap((macro) => macro.entries.map((entry) => entry.key_label)) ?? []}
                gd={gd}
                icons={icons}
                stacks={plan.stacks}
                pins={kb.pins}
                selected={selected}
                onSelect={(label) => { if (!disabled) { setSelected(label); setInspecting(true); } }}
              />
              <div className="guide-quickslots-legend" aria-label="Quickslot legend">
                <span className="text-gold"><span aria-hidden className="bg-gold" />By hand</span>
                <span className="text-cyan"><span aria-hidden className="bg-cyan" />In macro</span>
              </div>
              <p className="guide-slot-basis">Custom key layout; physical in-game slot restrictions are not yet verified.</p>
              {inspecting && <div className="guide-quickslots-detail space-y-2" role="region" aria-label={`Key ${selected} details`}
                onKeyDown={(event) => { if (event.key === "Escape") setInspecting(false); }}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Key {selected}</h3>
                  <button type="button" aria-label="Close slot details" onClick={() => setInspecting(false)} className="grid size-7 place-items-center" title="Close slot details"><X size={16} /></button></div>
                {stack.length ? (
                  <ol aria-label={`Key ${selected} skills`} className="guide-quickslots-skills">
                    {stack.map((skill) => (
                      <li key={skill} className="flex items-center gap-2 text-sm">
                        <SkillIcon url={icons[skill]} name={gd?.skills[skill]?.name ?? skill} size={28} />
                        <span className="min-w-0 break-words">{gd?.skills[skill]?.name ?? skill}</span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-faint">No skills assigned to this key.</p>}
                {plan.slot_notes?.[selected] && <p className="text-xs text-dim">{plan.slot_notes[selected]}</p>}
              </div>}
            </>
          )}
          </div>
        </section>
        <section aria-label="Macro" className="reference-panel">
          <h2 className="reference-panel-heading">Macro</h2>
          <div className="reference-panel-body">
          {macroPlan && (
            <MacroPanel
              compact
              showManual={false}
              plan={macroPlan}
              gd={gd}
              icons={icons}
              delayMs={kb.delayMs}
              onDelay={(value) => { if (!disabled) kb.setDelayMs(value); }}
              onHotkey={(which, key) => { if (!disabled) kb.setHotkey(which, key); }}
            />
          )}
          </div>
        </section>
        {plan && <section aria-label="How to play" className="reference-panel guide-how-to-play">
          <h2 className="reference-panel-heading">How to Play</h2>
          <div className="reference-panel-body">
            <ul className="guide-play-instructions">
              <li>Hold the macro key while fighting. Use the gold keys by hand.</li>
              {Object.entries(plan.manual_every_s).map(([skill, seconds]) => {
                const key = plan.stacks.find((slot) => slot.stack.includes(skill))?.key_label;
                return <li key={skill}><SkillIcon url={icons[skill]} name={gd?.skills[skill]?.name ?? skill} size={24} />
                  <strong>{gd?.skills[skill]?.name ?? skill}</strong><span>{key ? `key ${key}` : "Unassigned"}</span><span className="text-dim">~every {Math.round(seconds)} s</span></li>;
              })}
            </ul>
          </div>
        </section>}
      </fieldset>
    </section>
  );
}
