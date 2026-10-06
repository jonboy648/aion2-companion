import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GameData, IconUrls, KeybindPlan, MacroPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DELAY_MAX, DELAY_MIN, HOTKEY_CHOICES } from "./useKeybindPlan";
import { SkillIcon } from "./SkillIcon";
import "./compact-macro.css";

/** macro name -> (scenario key, hotkeys field) as the engine defines them. */
export const MACRO_META = {
  "Boss loop": { scenario: "boss_180", hotkey: "boss" as const, label: "Boss, single target" },
  "AoE loop": { scenario: "aoe_pack", hotkey: "aoe" as const, label: "AoE pack" },
  "Leveling loop": { scenario: "level_pull", hotkey: "leveling" as const, label: "Leveling pull" },
};

export type MacroHotkey = (typeof MACRO_META)[keyof typeof MACRO_META]["hotkey"];

export function macroEfficiency(plan: KeybindPlan, m: MacroPlan): { macro: number; ideal: number; pct: number } | null {
  if (plan.queue_status === "unverified") return null;
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
  compact = false,
  showManual = true,
}: {
  plan: KeybindPlan;
  gd: GameData | null;
  icons: IconUrls;
  onHotkey: (which: MacroHotkey, key: string) => void;
  delayMs: number;
  onDelay: (n: number) => void;
  compact?: boolean;
  showManual?: boolean;
}) {
  const [draftDelay, setDraftDelay] = useState(String(delayMs));
  useEffect(() => setDraftDelay(String(delayMs)), [delayMs]);
  const topSkill = (label: string) => plan.stacks.find((s) => s.key_label === label)?.stack[0];
  const nameOf = (k?: string) => (k ? gd?.skills[k]?.name ?? k : "");
  const slotOf = (skill: string) => plan.stacks.find((s) => s.stack.includes(skill))?.key_label;

  const delayControls = (
    <div className={compact ? "compact-macro-delay-controls" : "flex flex-wrap items-end gap-x-6 gap-y-3"}>
      <label className={compact ? "text-sm text-dim" : "text-xs text-dim"}>
        <span className="mb-1 block">Delay between presses (ms)</span>
        <input
          type="number"
          inputMode="numeric"
          min={DELAY_MIN}
          max={DELAY_MAX}
          step={5}
          value={compact ? draftDelay : delayMs}
          onChange={(e) => compact ? setDraftDelay(e.target.value) : onDelay(Number(e.target.value))}
          onBlur={() => { if (compact) onDelay(Number(draftDelay)); }}
          onKeyDown={(e) => {
            if (compact && e.key === "Enter") {
              e.preventDefault();
              onDelay(Number(draftDelay));
            }
          }}
          className="h-9 w-28 game-input px-2.5 text-sm text-foreground "
        />
      </label>
      <p className={compact ? "text-sm text-faint" : "max-w-md text-xs text-faint"}>
        Hold the macro key to attempt its entries; order is not guaranteed. Manual inputs take priority. Check Skill Queue and control mode in game.
      </p>
    </div>
  );

  const hotkeyControl = (m: MacroPlan) => {
    const meta = MACRO_META[m.name as keyof typeof MACRO_META];
    return (
      <label className={compact ? "compact-macro-hotkey text-sm text-dim" : "ml-auto flex items-center gap-2 text-xs text-dim"}>
        Hotkey
        {meta ? (
          <select
            value={m.hotkey}
            onChange={(e) => onHotkey(meta.hotkey, e.target.value)}
            className="h-8 game-input px-2 text-sm text-gold "
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
    );
  };

  const estimates = (m: MacroPlan) => {
    if (plan.queue_status === "unverified") return <p className="text-xs text-dim">Queue behavior unverified; no reliable macro DPS prediction.</p>;
    const eff = macroEfficiency(plan, m);
    return (
      <>
        <p className="text-xs text-estimated">Experimental sequential model, not validated game behavior.</p>
        {eff ? <DpsBar {...eff} /> : <p className="text-xs text-faint">No DPS estimate for this macro.</p>}
        {plan.hybrid_dps?.[m.name] != null && eff && (
          <p className="mt-1.5 text-xs text-dim" data-testid="hybrid-line">
            {compact ? "With hand presses: " : "With the hand presses below: "}<span className="font-semibold text-estimated">~{fmt(plan.hybrid_dps[m.name])}</span> DPS, about{" "}
            <span className="font-semibold text-foreground">{Math.round((plan.hybrid_dps[m.name] / eff.ideal) * 100)}%</span> of ideal.
          </p>
        )}
        {plan.macro_advice?.[m.name] && (
          <p className={compact ? "mt-2 text-sm text-dim" : "mt-2 rounded-md border border-[var(--metal-lo)] bg-gold/10 px-3 py-2 text-xs text-foreground"} data-testid="macro-advice">
            {plan.macro_advice[m.name]}
          </p>
        )}
      </>
    );
  };

  const manualSection = showManual && Object.keys(plan.manual_every_s).length > 0 && (
    <section aria-label="Press by hand">
      <h3 className="mb-2 text-sm font-semibold">Press by hand (not in any macro)</h3>
      <ul className={compact ? "compact-macro-manual" : "grid gap-1.5 sm:grid-cols-2"}>
        {Object.entries(plan.manual_every_s).map(([sk, s]) => (
          <li key={sk} className={compact ? "compact-macro-manual-entry" : "flex items-center gap-2.5 frame px-2.5 py-1.5 text-sm"}>
            <SkillIcon url={icons[sk]} name={nameOf(sk)} size={28} />
            <span className={compact ? "min-w-0 break-words" : "min-w-0 flex-1 truncate"}>{nameOf(sk)}</span>
            {compact ? <span className="text-sm text-gold">{slotOf(sk) ? `key ${slotOf(sk)}` : "unassigned"}</span> : <Badge tone="neutral">key {slotOf(sk) ?? "?"}</Badge>}
            <span className={compact ? "text-sm text-estimated" : "whitespace-nowrap text-xs text-estimated"}>~every {Math.round(s)} s</span>
          </li>
        ))}
      </ul>
    </section>
  );

  const conflicts = plan.warnings.filter((warning) => warning.toLowerCase().includes("binding conflict"));
  const emptyMessage = plan.queue_status === "unverified"
    ? "No entries: assign an acquired skill to a Quick Use action first."
    : "No entries: nothing in this rotation can run from a macro.";
  const mouseNotice = plan.queue_status === "unverified" && plan.macros.some((macro) => macro.entries.some((entry) => /mouse/i.test(entry.key_label)))
    && <p className="text-sm text-dim">Mouse entries require an in-game control-mode check; rebind to a keyboard key if unsupported.</p>;
  const conflictNotice = conflicts.length > 0 && <div role="alert" className="text-sm text-error">{conflicts.map((warning) => <p key={warning}>{warning}</p>)}</div>;
  if (compact) {
    return (
      <div className="compact-macro-panel">
        {conflictNotice}
        {mouseNotice}
        {plan.macros.map((m) => (
          <section key={m.name} aria-label={m.name} className="compact-macro">
            {m.entries.length === 0 ? (
              <p className="text-sm text-faint">{emptyMessage}</p>
            ) : (
              <ol className="compact-macro-steps" role="list" aria-label={`${m.name} entries`}>
                {m.entries.map((e) => {
                  const stack = plan.stacks.find((s) => s.key_label === e.key_label)?.stack ?? [];
                  const sk = stack[0];
                  const skillName = nameOf(sk) || `Key ${e.key_label}`;
                  const fallbacks = stack.slice(1).map((skill) => nameOf(skill));
                  return (
                    <li
                      key={e.index}
                      value={e.index}
                      aria-label={`Step ${e.index}: press key ${e.key_label}${stack.length ? ` (${stack.map((skill) => nameOf(skill)).join(", then ")})` : ""}, delay ${e.delay_ms} ms`}
                      title={`${e.index}. press key ${e.key_label}${sk ? ` (${nameOf(sk)})` : ""}, delay ${e.delay_ms} ms`}
                      className="compact-macro-step"
                    >
                      <span className="compact-macro-step-index" aria-hidden="true">{e.index}</span>
                      <SkillIcon url={sk ? icons[sk] : null} name={skillName} size={36} />
                      <div className="compact-macro-step-content">
                        <strong className="compact-macro-step-name">{skillName}</strong>
                        <div className="compact-macro-step-key">Key <span>{e.key_label}</span></div>
                        {fallbacks.length > 0 && <div className="compact-macro-step-fallbacks">Then {fallbacks.join(", then ")}</div>}
                      </div>
                      <span className="compact-macro-step-delay">Delay <span>{e.delay_ms}ms</span></span>
                    </li>
                  );
                })}
              </ol>
            )}
            <details className="compact-macro-details">
              <summary>Macro settings</summary>
              <div className="compact-macro-settings">
                {delayControls}
                {hotkeyControl(m)}
              </div>
            </details>
            {plan.queue_status !== "unverified" && <details className="compact-macro-details">
              <summary>Damage estimate</summary>
              <div className="compact-macro-estimates">{estimates(m)}</div>
            </details>}
          </section>
        ))}
        {manualSection}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {conflictNotice}
      {mouseNotice}
      {delayControls}

      {plan.macros.map((m) => {
        const meta = MACRO_META[m.name as keyof typeof MACRO_META];
        return (
          <section key={m.name} aria-label={m.name} className="frame p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold">{m.name}</h3>
              {meta && <span className="text-xs text-faint">{meta.label}</span>}
              {hotkeyControl(m)}
            </div>

            {m.entries.length === 0 ? (
              <p className="mt-3 text-sm text-faint">{emptyMessage}</p>
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
                      <span className="whitespace-nowrap text-[10px] text-faint">{e.delay_ms}ms</span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-3.5">
              {estimates(m)}
            </div>
          </section>
        );
      })}

      {manualSection}
    </div>
  );
}
