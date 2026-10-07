import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readPlannedBuild, useActiveBuild } from "@/features/keybinds/activeBuild";
import { Hotbar, SlotEditor } from "@/features/keybinds/Hotbar";
import { RotationPlan } from "@/features/build/RotationPlan";
import { MacroPanel } from "@/features/keybinds/MacroPanel";
import { SetupSheet } from "@/features/keybinds/SetupSheet";
import { isSlotHint, useKeybindPlan } from "@/features/keybinds/useKeybindPlan";

function Banner({ tone, children }: { tone: "info" | "warn" | "error"; children: React.ReactNode }) {
  const cls = { info: "border-cyan/40 bg-cyan/10", warn: "border-warn/40 bg-warn/10", error: "border-error/40 bg-error/10" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function KeybindsPage() {
  const active = useActiveBuild();
  const build = active.build;
  const planned = useMemo(() => readPlannedBuild(build), [build]);
  const kb = useKeybindPlan(build, planned);
  const [selected, setSelected] = useState("1");

  const header = (
    <PageHeader title="Keybinds and macros" caption="Quick Use bindings and macro setup for your character.">
      {build && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{build.name || "Unnamed"}</Badge>
          <Badge>{build.class_key}</Badge>
          <Badge>Lv {build.level}</Badge>
          {planned && <Badge tone="gold">{planned.playstyle}</Badge>}
          {active.source === "demo" && <Badge tone="warn">demo character</Badge>}
        </div>
      )}
    </PageHeader>
  );

  if (!build) {
    return (
      <>
        {header}
        <Card>
          <CardContent className="py-10 text-center">
            {active.loading ? (
              <p className="text-sm text-dim">Loading...</p>
            ) : (
              <>
                <p className="text-[15px] font-medium">No character loaded yet.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-dim">
                  Search your character on the home page first.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/">Find my character</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const result = kb.result;
  const plan = result?.plan;
  const rotation = plan?.rotation?.[planned?.scenario ?? "boss_180"];
  const stacks = plan?.stacks ?? [];
  const stackOf = (label: string) => stacks.find((s) => s.quick_use_id !== undefined ? String(s.quick_use_id) === label : s.key_label === label)?.stack ?? (kb.pins[label] ? [kb.pins[label]] : []);
  const hasSlotHints = (plan?.warnings ?? []).some(isSlotHint);

  return (
    <>
      {header}
      <div className="space-y-5">
        {kb.phase.status === "loading" && (
          <Banner tone="info">
            <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-cyan" />
            <div>
              <p className="font-medium">{kb.phase.message}...</p>
              <p className="text-xs text-dim">Loading client-table skill mappings.</p>
            </div>
          </Banner>
        )}
        {kb.phase.status === "error" && (
          <Banner tone="error">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
            <div className="flex-1">
              <p className="font-medium">Could not build the plan.</p>
              <p className="text-xs text-dim">{kb.phase.message}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={kb.rerun}>
              <RotateCcw /> Retry
            </Button>
          </Banner>
        )}
        {kb.phase.status === "ready" && !result && !kb.planError && (
          <div className="h-40 animate-pulse ornate" aria-busy="true" aria-label="Building plan" />
        )}
        {kb.planError && (
          <Banner tone="error">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
            <p>{kb.planError}</p>
          </Banner>
        )}

        {plan && result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Hotbar</CardTitle>
                <CardDescription>
                  Fixed and contextual slot restrictions are not fully verified. This is a suggested layout, not an imported in-game hotbar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Hotbar gd={kb.gd} icons={kb.icons} stacks={stacks} actions={plan.actions?.map((action) => ({ ...action, binding: kb.bindings[String(action.id)] ?? action.binding }))} onBinding={kb.setBinding} pins={kb.pins} selected={selected} onSelect={setSelected} />
                {kb.updating && <p role="status" className="text-xs text-dim">Updating setup...</p>}
                {kb.migrationNotice && <p role="status" className="text-xs text-estimated">{kb.migrationNotice}</p>}
                <SlotEditor
                  gd={kb.gd}
                  icons={kb.icons}
                  label={selected}
                  action={plan.actions?.find((action) => String(action.id) === selected)}
                  stack={stackOf(selected)}
                  pinnedSkill={kb.pins[selected]}
                  pins={kb.pins}
                  level={build.level}
                  region={build.region}
                  stigmas={build.stigmas}
                  onPin={(s) => kb.pin(selected, s)}
                  onUnpin={() => kb.unpin(selected)}
                  note={plan.slot_notes?.[selected]}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-faint">
                  {hasSlotHints && Object.keys(kb.pins).length === 0 && (
                    <span>Keys are suggestions. Move skills in the game's hotbar to match, or pin your current keys above.</span>
                  )}
                  {Object.keys(kb.pins).length > 0 && (
                    <Button variant="ghost" size="sm" onClick={kb.clearPins}>
                      <RotateCcw /> Clear {Object.keys(kb.pins).length} pin{Object.keys(kb.pins).length === 1 ? "" : "s"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {rotation?.core && (
              <Card>
                <CardHeader>
                  <CardTitle>Rotation</CardTitle>
                  <CardDescription>{planned ? `The selected ${planned.playstyle} plan.` : "Single-target boss rotation."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <RotationPlan rot={rotation} icons={kb.icons} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Macros</CardTitle>
                <CardDescription>Configuration candidates for {planned ? `your selected ${planned.playstyle} plan` : "your assigned skills"}. Entry numbering is not runtime execution order.</CardDescription>
              </CardHeader>
              <CardContent>
                <MacroPanel
                  plan={plan}
                  gd={kb.gd}
                  icons={kb.icons}
                  onHotkey={kb.setHotkey}
                  delayMs={kb.delayMs}
                  onDelay={kb.setDelayMs}
                />
                <p className="mt-4 text-xs text-faint">
                  <span className="text-estimated">~</span> marks a model estimate, not a measurement.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Setup sheet</CardTitle>
                <CardDescription>Quick Use identities, bindings, macro entries and validation limits.</CardDescription>
              </CardHeader>
              <CardContent>
                <SetupSheet markdown={result.instructions_markdown} filename={`aion2-keybinds-${build.class_key}.md`} />
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </>
  );
}

export default KeybindsPage;
