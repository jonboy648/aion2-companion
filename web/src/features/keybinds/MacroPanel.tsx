import { Badge } from "@/components/ui/badge";
import type { GameData, IconUrls, KeybindPlan, MacroPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DELAY_MAX, DELAY_MIN, HOTKEY_CHOICES, type Hotkeys } from "./useKeybindPlan";
import { SkillIcon } from "./SkillIcon";

/** macro name -> (scenario key, hotkeys field) as the engine defines them. */
export const MACRO_META = {
  "Boss loop": { scenario: "boss_180", hotkey: "boss" as const, label: "Boss, single target" },
  "AoE loop": { scenario: "aoe_pack", hotkey: "aoe" as const, label: "AoE pack" },
};

export function macroEfficiency(plan: KeybindPlan, m: MacroPlan): { macro: number; ideal: number; pct: number } | null {
  const meta = MACRO_META[m.name as keyof typeof MACRO_META];
  const macro = plan.macro_dps[m.name];
  const ideal = meta ? plan.ideal_dps[meta.scenario] : undefined;
  if (macro == null || !ideal || ideal <= 0) return null;
  return { macro, ideal, pct: (macro / ideal) * 100 };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function DpsBar({ macro, ideal, pct }: { macro: number; ideal: number; pct: number }) {
  const good = pct >= 95;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="text-dim">
          Macro <span className="font-semibold text-estimated">~{fmt(macro)}</span> DPS vs ideal{" "}
          <span className="font-semibold text-foreground">~{fmt(ideal)}</span>
        </span>
        <span className={cn("font-semibold", good ? "text-ok" : "text-estimated")}>~{Math.round(pct)}% of ideal</span>
      </div>
      <div
        role="img"
        aria-label={`Macro reaches about ${Math.round(pct)} percent of ideal damage`}
        className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface3"
      >
        <div className={cn("h-full rounded-full", good ? "bg-ok" : "bg-estimated")} style={{ width: `${Math.min(100, pct)}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: "95%" }} title="95% threshold" />
      </div>
    </div>
  );
}

export function MacroPanel({
  plan,
  gd,
  icons,
  onHotkey,
  delayMs,
  onDelay,
}: {
  plan: KeybindPlan;
  gd: GameData | null;
  icons: IconUrls;
  onHotkey: (which: keyof Hotkeys, key: string) => void;
  delayMs: number;
  onDelay: (n: number) => void;
}) {
  const topSkill = (label: string) => plan.stacks.find((s) => s.key_label === label)?.stack[0];
  const nameOf = (k?: string) => (k ? gd?.skills[k]?.name ?? k : "");
  const slotOf = (skill: string) => plan.stacks.find((s) => s.stack.includes(skill))?.key_label;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="text-xs text-dim">
          <span className="mb-1 block">Delay between presses (ms)</span>
          <input
            type="number"
            inputMode="numeric"
            min={DELAY_MIN}
            max={DELAY_MAX}
            step={5}
            value={delayMs}
            onChange={(e) => onDelay(Number(e.target.value))}
            className="h-9 w-28 rounded-md border border-border bg-bg px-2.5 text-sm text-foreground outline-none focus:border-gold"
          />
        </label>
        <p className="max-w-md text-xs text-faint">
          The in-game macro runs only while its key is held and walks the entries in order. Entries it cannot use are skipped, so it only approximates priority.
        </p>
      </div>

      {plan.macros.map((m) => {
        const meta = MACRO_META[m.name as keyof typeof MACRO_META];
        const eff = macroEfficiency(plan, m);
        return (
          <section key={m.name} aria-label={m.name} className="rounded-lg border border-border-soft bg-surface2/50 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold">{m.name}</h3>
              {meta && <span className="text-xs text-faint">{meta.label}</span>}
              <label className="ml-auto flex items-center gap-2 text-xs text-dim">
                Hotkey
                {meta ? (
                  <select
                    value={m.hotkey}
                    onChange={(e) => onHotkey(meta.hotkey, e.target.value)}
                    className="h-8 rounded-md border border-border bg-bg px-2 text-sm text-gold outline-none focus:border-gold"
                  >
                    {[...new Set([...HOTKEY_CHOICES, m.hotkey])].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone="gold">{m.hotkey}</Badge>
                )}
              </label>
            </div>

            {m.entries.length === 0 ? (
              <p className="mt-3 text-sm text-faint">No entries: nothing in this rotation can run from a macro.</p>
            ) : (
              <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`${m.name} entries`}>
                {m.entries.map((e) => {
                  const sk = topSkill(e.key_label);
                  return (
                    <li
                      key={e.index}
                      title={`${e.index}. press slot ${e.key_label}${sk ? ` (${nameOf(sk)})` : ""}, delay ${e.delay_ms} ms`}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-1"
                    >
                      <span className="w-4 text-center text-[10px] text-faint">{e.index}</span>
                      <SkillIcon url={sk ? icons[sk] : null} name={nameOf(sk) || e.key_label} size={22} />
                      <span className="text-xs font-semibold text-gold">{e.key_label}</span>
                      <span className="text-[10px] text-faint">{e.delay_ms}ms</span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-3.5">
              {eff ? <DpsBar {...eff} /> : <p className="text-xs text-faint">No DPS estimate for this macro.</p>}
            </div>
          </section>
        );
      })}

      {Object.keys(plan.manual_every_s).length > 0 && (
        <section aria-label="Press by hand">
          <h3 className="mb-2 text-sm font-semibold">Press by hand (not in any macro)</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {Object.entries(plan.manual_every_s).map(([sk, s]) => (
              <li key={sk} className="flex items-center gap-2.5 rounded-md border border-border-soft bg-surface px-2.5 py-1.5 text-sm">
                <SkillIcon url={icons[sk]} name={nameOf(sk)} size={28} />
                <span className="min-w-0 flex-1 truncate">{nameOf(sk)}</span>
                <Badge tone="neutral">key {slotOf(sk) ?? "?"}</Badge>
                <span className="whitespace-nowrap text-xs text-estimated">~every {Math.round(s)} s</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
