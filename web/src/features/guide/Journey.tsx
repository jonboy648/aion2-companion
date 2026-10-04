import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAPTERS, chapterForLevel, chapterShort } from "./chapters";

export const FIRST_HOUR_ID = "first-hour";

/**
 * The journey as a stepper: first hour, five level bands, endgame. Each step links to its chapter in the guide.
 * Shared by the guide and the road map so both read as the same path.
 */
export function JourneyStrip({ level, className }: { level: number | null; className?: string }) {
  const current = level == null ? null : chapterForLevel(level);
  const curIdx = current ? CHAPTERS.indexOf(current) : -1;
  const steps = [{ id: FIRST_HOUR_ID, label: "First hour", sub: "Pick a class" }, ...CHAPTERS.map((c) => ({ id: c.id, label: chapterShort(c), sub: "" }))];
  return (
    <nav aria-label="Your journey" className={className}>
      <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {steps.map((s, i) => {
          const chIdx = i - 1;
          const state = i === 0 ? "start" : chIdx < curIdx ? "done" : chIdx === curIdx ? "current" : "later";
          return (
            <li key={s.id} aria-current={state === "current" ? "step" : undefined} className="relative">
              <Link
                to={`/guide?chapter=${s.id}`}
                className={cn(
                  "flex h-full flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center no-underline transition-colors",
                  state === "current" && "border-gold bg-gold/15 text-gold shadow-[0_0_0_3px_rgb(224_180_88/0.15)]",
                  state === "done" && "border-ok/40 bg-ok/5 text-dim hover:border-ok",
                  (state === "later" || state === "start") && "border-border-soft bg-surface text-dim hover:border-gold-lo hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-[11px] font-semibold",
                    state === "current" ? "border-gold bg-gold text-gold-ink" : state === "done" ? "border-ok/60 bg-ok/15 text-ok" : "border-border bg-surface2",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="text-[11px] font-medium leading-tight sm:text-xs">{s.label}</span>
                {state === "current" && <span className="text-[10px] font-semibold uppercase tracking-wide">You are here</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
