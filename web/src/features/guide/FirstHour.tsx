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
        <p className="mb-4 text-sm text-dim">Both factions share these eight classes. Choose the role you enjoy.</p>
        <ul className="guide-classes">
          {CLASS_BLURBS.map((c) => {
            const Icon = ICON[c.key] ?? Sparkles;
            const on = classKey === c.key;
            return (
              <li key={c.key}>
                <div className={cn("guide-class", on && "guide-class-selected")}>
                  <button type="button" aria-pressed={on} onClick={() => onPick(c.key)} className="guide-class-pick">
                    <img src={`/brand/classes/${c.key}-320.webp`} alt="" width={320} height={320} loading="lazy" className="guide-class-art" />
                    <span className="guide-class-title"><Icon aria-hidden className="size-4" /><span>{c.name}</span></span>
                    <span className="guide-class-role">{c.role}</span>
                    <span className="guide-class-description">{c.line}</span>
                    <span className={cn("guide-class-difficulty", DIFF_TONE[c.difficulty])}>{c.difficulty}</span>
                  </button>
                  <Link to={`/codex/${c.key}`} className="guide-class-skills">
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
