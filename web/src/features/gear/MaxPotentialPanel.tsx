import { GameButton, IconFrame, OrnateCard, SectionTitle, rarityOf } from "@/components/game";
import { Badge } from "@/components/ui/badge";
import { fmtDps } from "@/features/build/helpers";
import type { MaxPotentialResult } from "@/lib/types";
import { fmtGain, slotLabel } from "./logic";

interface Props {
  result: MaxPotentialResult | null;
  busy: boolean;
  error: string | null;
  onRun: () => void;
  classLabel: string;
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="min-w-0 frame px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="truncate font-display text-xl font-bold text-gold" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

/** What a fully geared build of this class reaches, versus the imported character. Computed on demand (slow). */
export function MaxPotentialPanel({ result, busy, error, onRun, classLabel }: Props) {
  const now = result?.with_current_gear ?? null;
  // both are full searches, so they compare directly; without a character, fall back to the engine's own gap
  const gap = result ? (now && now.dps > 0 ? (result.dps / now.dps - 1) * 100 : result.gain_vs_current_pct) : null;
  return (
    <OrnateCard className="mb-6 p-4 sm:p-5" data-testid="max-potential">
      <SectionTitle as="h2" caption={`What your gear allows today, and the ceiling with best-in-slot gear and every Daevanion point for a ${classLabel}. The ceiling is an upper bound, not a promise.`}>
        Max potential
      </SectionTitle>
      {!result && (
        <div className="flex flex-wrap items-center gap-3">
          <GameButton size="sm" onClick={onRun} disabled={busy}>
            {busy ? "Calculating..." : "Calculate max potential"}
          </GameButton>
          <span className="text-xs text-dim">Runs the full optimizer, so it takes a while.</span>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          Could not compute max potential: {error}
        </p>
      )}
      {result && (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {now && <Stat label="Best with your gear" value={`~${fmtDps(now.dps)} DPS`} testId="with-current" />}
            <Stat label="Fully geared" value={`~${fmtDps(result.dps)} DPS`} />
            <Stat label={now ? "Ceiling vs best now" : "Gap vs you"} value={gap != null ? fmtGain(gap) : "n/a"} testId="gap" />
            <Stat label="From gear alone" value={fmtGain(result.gear_gain_pct)} />
          </div>
          {now && (
            <p className="mb-4 text-xs text-dim" data-testid="with-current-note">
              Best with your gear: your current gear and the {now.daevanion_nodes} Daevanion nodes you have opened, with stigmas, skill ranks and specialties chosen for you
              ({now.stigmas.map((s) => s.name).join(", ")}). The playstyle cards above use the same assumption, so they match this number.
            </p>
          )}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Best in slot</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.gear.map((g) => (
              <li key={g.slot} className="frame flex min-w-0 items-center gap-2.5 p-2" data-testid="bis-row">
                <IconFrame name={g.name} url={g.icon} size={40} rarity={rarityOf(g.grade)} alt="" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-wide text-faint">{slotLabel(g.slot)}</span>
                  <span className="block truncate text-[13px]" title={g.name}>
                    {g.name}
                  </span>
                </span>
                <Badge tone="gold">+{g.enchant}</Badge>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-faint">The rest of the build</h3>
          <p className="text-sm text-dim">
            <span className="font-semibold text-gold">{result.build.daevanion_nodes}</span> Daevanion nodes
            {result.build.stigmas.length > 0 && <> - stigmas: {result.build.stigmas.map((s) => s.name).join(", ")}</>}
          </p>
          {result.build.specialties.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-dim">
              {result.build.specialties.slice(0, 5).map((s) => (
                <li key={`${s.skill}-${s.text}`}>
                  {s.skill}: {s.text} <span className="text-gold">{fmtGain(s.dps_gain_pct)}</span>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-4 text-xs text-dim">
            <summary className="cursor-pointer text-cyan">Assumptions ({result.assumptions.length + result.notes.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {[...result.assumptions, ...result.notes].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </OrnateCard>
  );
}
