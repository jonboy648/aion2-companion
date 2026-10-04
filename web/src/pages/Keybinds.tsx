import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveBuild } from "@/features/keybinds/activeBuild";
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
  const kb = useKeybindPlan(build);
  const [selected, setSelected] = useState("1");

  const header = (
    <PageHeader title="Keybinds and macros" caption="Your best rotation as hotbar stacks, in-game macros and a one-key-remap sheet for Logitech G915 / G900.">
      {build && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{build.name || "Unnamed"}</Badge>
          <Badge>{build.class_key}</Badge>
          <Badge>Lv {build.level}</Badge>
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
                  The keybind plan is built from your character's best rotation. Search your character on the home page first.
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
  const stacks = plan?.stacks ?? [];
  const stackOf = (label: string) => stacks.find((s) => s.key_label === label)?.stack ?? (kb.pins[label] ? [kb.pins[label]] : []);
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
              <p className="text-xs text-dim">The result is cached for this character, so the next visit is instant.</p>
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
                  Each key holds up to 4 stacked skills, drawn as in game: one press fires the usable skill in the lowest cell (the bottom cell is
                  priority 0). To reorder in game, click a skill, then click another cell in the column to swap them. Select a key to pin the skill you
                  already keep there, and the planner builds around it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Hotbar gd={kb.gd} icons={kb.icons} stacks={stacks} pins={kb.pins} selected={selected} onSelect={setSelected} />
                <SlotEditor
                  gd={kb.gd}
                  icons={kb.icons}
                  label={selected}
                  stack={stackOf(selected)}
                  pinnedSkill={kb.pins[selected]}
                  pins={kb.pins}
                  level={build.level}
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

            {plan.rotation?.boss_180?.core && (
              <Card>
                <CardHeader>
                  <CardTitle>Rotation</CardTitle>
                  <CardDescription>What the stacks and macros below are trying to do, step by step (single-target boss).</CardDescription>
                </CardHeader>
                <CardContent>
                  <RotationPlan rot={plan.rotation.boss_180} icons={kb.icons} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Macros</CardTitle>
                <CardDescription>Two in-game macros built from the stacks above, with their estimated damage against pressing every skill perfectly by hand.</CardDescription>
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
                <CardTitle>Setup sheet: hotbar, macros, G915 / G900</CardTitle>
                <CardDescription>Everything above as step-by-step instructions, including the Logitech G HUB one-key-remap layout.</CardDescription>
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
