import { Link } from "react-router-dom";
import { Crosshair, HeartPulse, Music, Shield, Sparkles, Sword, Swords, WandSparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASS_BLURBS, CONTROLS, IGNORE_EARLY, type Difficulty } from "./basics";

const ICON: Record<string, LucideIcon> = {
  gladiator: Swords,
  templar: Shield,
  assassin: Sword,
  ranger: Crosshair,
  sorcerer: WandSparkles,
  spiritmaster: Sparkles,
  cleric: HeartPulse,
  chanter: Music,
};

const DIFF_TONE: Record<Difficulty, string> = {
  Easier: "border-ok/40 bg-ok/10 text-ok",
  Medium: "border-warn/40 bg-warn/10 text-warn",
  Harder: "border-error/40 bg-error/10 text-error",
};

export function FirstHour({ classKey, onPick }: { classKey: string | null; onPick: (k: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold">1. Pick a class</h3>
        <p className="mb-3 text-sm text-dim">You choose once at character creation. Both factions get the same eight classes. Pick the playstyle you enjoy; selecting a card below also shows that class's unlocks in the chapters.</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CLASS_BLURBS.map((c) => {
            const Icon = ICON[c.key] ?? Sparkles;
            const on = classKey === c.key;
            return (
              <li key={c.key}>
                <div className={cn("flex h-full flex-col rounded-lg border p-3", on ? "border-gold bg-gold/10" : "border-border-soft bg-surface")}>
                  <button type="button" aria-pressed={on} onClick={() => onPick(c.key)} className="flex items-center gap-2.5 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-gold-lo/60 bg-gold/10 text-gold">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-xs text-dim">{c.role}</span>
                    </span>
                    <span className={cn("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", DIFF_TONE[c.difficulty])}>{c.difficulty}</span>
                  </button>
                  <p className="mt-2 flex-1 text-xs text-dim">{c.line}</p>
                  <Link to={`/codex/${c.key}`} className="mt-2 text-xs text-cyan">
                    See {c.name} skills
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-faint">Difficulty is our reading of community class notes, not an official rating.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div>
          <h3 className="mb-2 text-base font-semibold">2. Learn the controls</h3>
          <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            {CONTROLS.map((c) => (
              <div key={c.keys} className="contents">
                <dt>
                  <kbd className="whitespace-nowrap rounded border border-border bg-surface3 px-1.5 py-0.5 font-mono text-xs text-gold">{c.keys}</kbd>
                </dt>
                <dd className="text-dim">
                  {c.what}
                  {c.check && <span className="ml-1.5 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-px text-[10px] text-warn" title={c.check}>check</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-faint">Default global keys. Settings, Key Settings changes any of them. The default mode keeps a crosshair in the screen centre; hold Alt for the mouse.</p>
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold">3. What to ignore for now</h3>
          <ul className="space-y-1.5 text-sm text-dim">
            {IGNORE_EARLY.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
