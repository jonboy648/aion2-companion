import { Input } from "@/components/ui/input";
import { levelBudget, type EarnedPoints } from "./progression";

interface Props {
  level: string;
  levelCap: number;
  onLevel: (level: string) => void;
  earned: EarnedPoints;
  onEarned: (points: EarnedPoints) => void;
  stigmaUnlocked: boolean;
  onStigmaUnlocked: (unlocked: boolean) => void;
  daevanionUnlocked: boolean;
  onDaevanionUnlocked: (unlocked: boolean) => void;
}

export function ProgressionControls(p: Props) {
  const level = Number(p.level);
  const budget = levelBudget(level);
  const metrics = [
    ["Skill points", budget ? budget.skill + p.earned.skill : null],
    ["Stigma points", budget ? budget.stigma + p.earned.stigma : null],
    ["Stigma slots", budget?.stigmaSlots ?? null],
    ["Daevanion points", budget ? budget.daevanion + p.earned.daevanion : null],
  ] as const;
  return (
    <section aria-label="Progression budgets" className="mb-5 space-y-4 border-y border-border-soft py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-dim">Level (1 to {p.levelCap})</span>
          <Input aria-label={`Level (1 to ${p.levelCap})`} inputMode="numeric" className="w-20 text-center tabular-nums"
            value={p.level} onChange={(e) => p.onLevel(e.target.value)} />
        </label>
        <input type="range" aria-label="Preview character level" min={1} max={p.levelCap} step={1}
          value={Number.isFinite(level) ? Math.max(1, Math.min(p.levelCap, level)) : 1}
          onChange={(e) => p.onLevel(e.target.value)} className="min-w-40 flex-1 accent-[var(--gold)]" />
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {metrics.map(([name, value]) => <div key={name}>
          <dt className="text-xs text-dim">{name}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{value ?? "-"}</dd>
        </div>)}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.stigmaUnlocked} disabled={!budget || budget.stigmaSlots === 0}
            onChange={(e) => p.onStigmaUnlocked(e.target.checked)} className="size-4 accent-[var(--gold)]" />
          Stigma unlock quest and ascension completed
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.daevanionUnlocked} disabled={!budget || budget.daevanion === 0}
            onChange={(e) => p.onDaevanionUnlocked(e.target.checked)} className="size-4 accent-[var(--gold)]" />
          Daevanion unlock quest completed
        </label>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-cyan">Earned rewards</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["skill", "stigma", "daevanion"] as const).map((key) => <label key={key}>
            <span className="mb-1 block text-xs text-dim">Extra {key} points</span>
            <Input type="number" min={0} max={10000} step={1} value={p.earned[key]}
              onChange={(e) => p.onEarned({ ...p.earned, [key]: Number(e.target.value) })} />
          </label>)}
        </div>
        <p className="mt-2 text-xs text-faint">Quest and dungeon rewards already earned, beyond the level totals. Gear and combat stats stay as entered.</p>
      </details>
      <p className="text-xs text-faint">Global leveling baseline. Client version unverified; optional rewards are not assumed.</p>
    </section>
  );
}
