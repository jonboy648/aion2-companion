import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassData } from "@/features/build/useClassData";
import { hashBuild, MACRO_SCENARIOS, type MacroScenario, type PlannedBuild } from "@/features/keybinds/activeBuild";
import { Hotbar } from "@/features/keybinds/Hotbar";
import { MACRO_META, MacroPanel } from "@/features/keybinds/MacroPanel";
import { SkillIcon } from "@/features/keybinds/SkillIcon";
import { useKeybindPlan } from "@/features/keybinds/useKeybindPlan";
import type { FullBuild } from "@/lib/types";
import "./guide-quickslots.css";

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

  return (
    <section aria-label="Quickslots and macro" aria-disabled={disabled} inert={disabled} className="guide-quickslots min-w-0">
      <fieldset disabled={disabled} className="guide-quickslots-sections min-w-0 border-0 p-0">
        <section aria-label="Quickslots" className="min-w-0 space-y-3">
          <h2 className="text-base font-semibold">Quickslots</h2>
          <p className="text-xs text-faint">Suggested key stacks. Fixed and contextual in-game slot restrictions are not yet verified.</p>
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
              <div className="guide-quickslots-legend" aria-label="Quickslot legend">
                <span className="text-gold"><span aria-hidden className="bg-gold" />By hand</span>
                <span className="text-cyan"><span aria-hidden className="bg-cyan" />In macro</span>
              </div>
              <Hotbar
                compact
                manualSkills={Object.keys(plan.manual_every_s)}
                macroKeys={macroPlan?.macros.flatMap((macro) => macro.entries.map((entry) => entry.key_label)) ?? []}
                gd={gd}
                icons={icons}
                stacks={plan.stacks}
                pins={kb.pins}
                selected={selected}
                onSelect={(label) => { if (!disabled) setSelected(label); }}
              />
              <div className="guide-quickslots-detail space-y-2">
                <h3 className="text-sm font-semibold">Key {selected}</h3>
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
              </div>
            </>
          )}
        </section>
        <section aria-label="Macro" className="min-w-0 space-y-3">
          <h2 className="text-base font-semibold">Macro</h2>
          {macroPlan && (
            <MacroPanel
              compact
              plan={macroPlan}
              gd={gd}
              icons={icons}
              delayMs={kb.delayMs}
              onDelay={(value) => { if (!disabled) kb.setDelayMs(value); }}
              onHotkey={(which, key) => { if (!disabled) kb.setHotkey(which, key); }}
            />
          )}
        </section>
      </fieldset>
    </section>
  );
}
