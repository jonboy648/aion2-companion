import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { EVENTS, REGIONS } from "./data";
import { RegionTabs } from "./RegionTabs";
import { stripChips, type Chip } from "./status";
import { formatLocal, useNow, useRegion } from "./useTimers";
import { cn } from "@/lib/utils";

function Dropdown({ chip, now, anchorRight }: { chip: Chip; now: number; anchorRight: boolean }) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-[var(--border-soft)] bg-bg p-3 text-xs shadow-lg",
        "sm:w-72",
        anchorRight ? "sm:left-auto sm:right-0" : "sm:right-auto",
      )}
    >
      <p className="mb-1.5 font-semibold text-gold">Next {chip.upcoming.length}, your local time</p>
      <ul className="space-y-1">
        {chip.upcoming.map((o) => (
          <li key={`${o.event}-${o.start}`} className="flex justify-between gap-3">
            <span className={cn(o.start <= now && o.end > now ? "text-ok" : "text-dim")}>
              {chip.id === "boss" ? EVENTS[o.event].short : EVENTS[o.event].name}
              {o.start <= now && o.end > now ? " (now)" : ""}
            </span>
            <span className="tabular-nums">{formatLocal(o.start)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2">
        <RegionTabs />
        <Link to="/timers" className="whitespace-nowrap">
          All timers
        </Link>
      </div>
    </div>
  );
}

/** Live event countdowns under the site header. Placeholders until mounted so prerendered HTML matches. */
export function TimerStrip() {
  const now = useNow();
  const [region] = useRegion();
  const [open, setOpen] = useState<Chip["id"] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef("mouse");

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const chips = now === null ? null : stripChips(region, now);
  const ids: Chip["id"][] = ["shugo", "rift", "boss", "daily"];

  return (
    <div
      ref={root}
      aria-label="Game timers"
      role="region"
      className="relative mx-auto flex max-w-6xl items-center gap-x-4 gap-y-1 border-t border-[var(--border-soft)] px-4 py-1 text-xs"
    >
      <Clock aria-hidden className="size-3.5 shrink-0 text-faint" />
      {ids.map((id, i) => {
        const chip = chips?.find((c) => c.id === id);
        return (
          <div
            key={id}
            // boss and daily are hidden on phones; the dropdown of the others links to /timers
            className={cn("sm:relative", i >= 2 && "hidden sm:block")}
            onPointerEnter={(e) => {
              pointer.current = e.pointerType;
              if (e.pointerType === "mouse" && chip) setOpen(id);
            }}
            onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o === id ? null : o))}
          >
            <button
              type="button"
              aria-expanded={open === id}
              disabled={!chip}
              onPointerDown={(e) => (pointer.current = e.pointerType)}
              onClick={() => setOpen((o) => (pointer.current === "mouse" ? id : o === id ? null : id))}
              className="flex items-baseline gap-1.5 whitespace-nowrap bg-transparent py-1 text-xs hover:text-gold"
            >
              <span className="text-dim">{chip?.label ?? { shugo: "Shugo", rift: "Rift", boss: "Boss", daily: "Daily reset" }[id]}</span>
              <span className={cn("tabular-nums", chip?.active && "font-semibold text-ok")} aria-live="off">
                {chip ? (
                  <>
                    <span className="sm:hidden">{chip.compact}</span>
                    <span className="hidden sm:inline">{chip.text}</span>
                  </>
                ) : (
                  "--"
                )}
              </span>
            </button>
            {chip && now !== null && open === id && <Dropdown chip={chip} now={now} anchorRight={i >= 2} />}
          </div>
        );
      })}
      <span className="ml-auto hidden text-faint sm:inline">{REGIONS[region].label}</span>
      <Link to="/timers" className="ml-auto whitespace-nowrap py-1 text-xs sm:ml-0">
        Timers
      </Link>
    </div>
  );
}
