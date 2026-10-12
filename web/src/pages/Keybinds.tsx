import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readPlannedBuild, useActiveBuild } from "@/features/keybinds/activeBuild";
import { NativeQuickslots } from "@/features/keybinds/NativeQuickslots";
import { useKeybindPlan } from "@/features/keybinds/useKeybindPlan";

export function KeybindsPage() {
  const active = useActiveBuild();
  const build = active.build;
  const planned = useMemo(() => readPlannedBuild(build), [build]);
  const kb = useKeybindPlan(build, planned, true);
  const error = kb.planError ?? (kb.phase.status === "error" ? kb.phase.message : null);

  return <>
    <div className="native-keybind-header"><PageHeader title="Quickslots and macros">
      {build && <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">{build.name || "Unnamed"}</Badge>
        <Badge>{build.class_key}</Badge><Badge>Lv {build.level}</Badge>
        {planned && <Badge tone="gold">{planned.playstyle}</Badge>}
        {active.source === "demo" && <Badge tone="warn">demo character</Badge>}
      </div>}
    </PageHeader></div>
    {!build ? <section className="py-10 text-center">
      {active.loading ? <p role="status">Loading character...</p> : <>
        <p className="font-medium">No character loaded yet.</p>
        <Button asChild className="mt-4"><Link to="/">Find my character</Link></Button>
      </>}
    </section> : error ? <div role="alert" className="flex items-start gap-3 rounded border border-error/40 p-4">
      <AlertTriangle aria-hidden className="mt-1 size-4 shrink-0 text-error" />
      <div className="min-w-0 flex-1"><p>Could not load Quick Use mappings.</p><p className="break-words text-sm text-dim">{error}</p></div>
      <Button variant="secondary" size="sm" onClick={kb.rerun}><RotateCcw />Retry</Button>
    </div> : kb.result && kb.gd ? <NativeQuickslots build={build} gd={kb.gd} icons={kb.icons} plan={kb.result.plan} />
      : <div role="status" className="flex items-center gap-2 py-8 text-dim"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Loading Quick Use mappings...</div>}
  </>;
}

export default KeybindsPage;
