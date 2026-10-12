import { useMemo } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassData } from "@/features/build/useClassData";
import { hashBuild, MACRO_SCENARIOS, type MacroScenario, type PlannedBuild } from "@/features/keybinds/activeBuild";
import { NativeQuickslots } from "@/features/keybinds/NativeQuickslots";
import { useKeybindPlan } from "@/features/keybinds/useKeybindPlan";
import type { FullBuild } from "@/lib/types";

type Props = { fb: FullBuild; data: ClassData; disabled?: boolean };

export function GuideQuickslots({ fb, data, disabled = false }: Props) {
  const { build, planned } = useMemo(() => {
    const build = { ...fb.build, skill_points: 0, stigma_points: 0 };
    const scenario = fb.playstyle.scenario.key as MacroScenario;
    const planned: PlannedBuild | null = MACRO_SCENARIOS.includes(scenario) ? {
      buildHash: hashBuild(build), playstyle: fb.playstyle.key, scenario, priority: fb.priority,
    } : null;
    return { build, planned };
  }, [fb]);
  const kb = useKeybindPlan(build, planned, true);
  const error = kb.planError ?? (kb.phase.status === "error" ? kb.phase.message : null);
  const plan = kb.phase.status === "ready" && !error ? kb.result?.plan : undefined;
  const gd = kb.gd ?? data.gd;
  const icons = { ...data.icons, ...kb.icons };

  return <section aria-label="Quickslots and macro" aria-disabled={disabled} inert={disabled} className="min-w-0">
    <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
      {error ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-error">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 break-words">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => { if (!disabled) kb.rerun(); }}><RotateCcw aria-hidden />Retry</Button>
      </div> : plan && gd ? <NativeQuickslots build={build} gd={gd} icons={icons} plan={plan} disabled={disabled} /> :
        <div role="status" aria-busy="true" className="flex items-start gap-2 text-sm text-dim">
          <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
          <div><p>Loading quickslots</p>{kb.phase.status === "loading" && <p className="text-xs">{kb.phase.message}</p>}</div>
        </div>}
    </fieldset>
  </section>;
}
