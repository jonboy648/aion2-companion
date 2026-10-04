import { Fragment, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Check, Gem, Hexagon, MapPin, Settings2, Shield, Sword } from "lucide-react";
import type { RoadmapItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chapterForLevel, chapterRange } from "@/features/guide/chapters";
import { groupStates, KIND_LABEL, type GroupState, type LevelGroup } from "./levels";

const KIND_ICON = { skill: Sword, zone: MapPin, system: Settings2, stigma: Gem, gear: Shield, daevanion: Hexagon } as const;
const KIND_TONE: Record<RoadmapItem["kind"], string> = {
  skill: "text-gold bg-gold/10 border-gold-lo/60",
  zone: "text-cyan bg-cyan/10 border-cyan/40",
  system: "text-dim bg-surface3 border-border",
  stigma: "text-[#4a9df0] bg-[#4a9df0]/10 border-[#4a9df0]/40",
  gear: "text-ok bg-ok/10 border-ok/40",
  daevanion: "text-[#f0922f] bg-[#f0922f]/10 border-[#f0922f]/40",
};

const STATE_LABEL: Partial<Record<GroupState, string>> = { current: "Your current band", next: "Next unlock" };

export function Timeline({ groups, level }: { groups: LevelGroup[]; level: number }) {
  const states = groupStates(groups, level);
  const currentRef = useRef<HTMLLIElement | null>(null);
  const currentLevel = groups[states.indexOf("current")]?.level;

  useEffect(() => {
    // bring the band into view once per level change; guarded because jsdom has no scrollIntoView
    currentRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [currentLevel]);

  return (
    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[27px] before:top-3 before:w-px before:bg-border-soft sm:before:left-[31px]">
      {groups.map((g, i) => {
        const st = states[i];
        const isCurrent = st === "current";
        const ch = chapterForLevel(g.level);
        const startsChapter = i === 0 || chapterForLevel(groups[i - 1].level).id !== ch.id;
        return (
          <Fragment key={g.level}>
          {startsChapter && (
            <li className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface3 px-3 py-2">
              <h2 className="text-sm font-semibold text-gold">
                {ch.hi === Infinity ? "Endgame" : `Levels ${chapterRange(ch)}`}: {ch.title.replace(/^[^:]*: /, "")}
              </h2>
              <Link to={`/guide?chapter=${ch.id}`} className="ml-auto text-xs text-cyan">
                Open guide chapter
              </Link>
            </li>
          )}
          <li ref={isCurrent ? currentRef : undefined} aria-current={isCurrent ? "step" : undefined} className="relative flex gap-3 sm:gap-4">
            <div
              className={cn(
                "relative z-10 grid size-[54px] shrink-0 place-items-center rounded-full border-2 text-center sm:size-16",
                st === "done" && "border-border bg-surface2 text-dim",
                isCurrent && "border-gold bg-gold text-gold-ink shadow-[0_0_0_4px_rgb(224_180_88/0.18)]",
                st === "next" && "border-cyan bg-surface3 text-cyan",
                st === "later" && "border-border-soft bg-surface text-faint",
              )}
            >
              <span className="leading-none">
                <span className="block text-[9px] uppercase tracking-wider opacity-80">Lv</span>
                <span className="text-lg font-bold tabular-nums">{g.level}</span>
              </span>
            </div>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-lg border p-3",
                st === "done" && "border-border-soft bg-surface/50",
                isCurrent && "border-gold bg-surface2",
                st === "next" && "border-cyan/50 bg-surface",
                st === "later" && "border-border-soft bg-surface",
              )}
            >
              {STATE_LABEL[st] && (
                <p className={cn("mb-1.5 text-[11px] font-semibold uppercase tracking-wider", isCurrent ? "text-gold" : "text-cyan")}>
                  {STATE_LABEL[st]}
                  {isCurrent && level > g.level ? ` · you are level ${level}` : ""}
                  {isCurrent && level === g.level ? " · you are here" : ""}
                </p>
              )}
              <ul className="space-y-1.5">
                {g.items.map((it, j) => {
                  const Icon = KIND_ICON[it.kind];
                  return (
                    <li key={j} className={cn("flex items-start gap-2.5 text-sm", st === "done" ? "text-dim" : "text-foreground")}>
                      <span
                        title={KIND_LABEL[it.kind]}
                        className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border", KIND_TONE[it.kind])}
                      >
                        <Icon aria-hidden className="size-3.5" />
                        <span className="sr-only">{KIND_LABEL[it.kind]}</span>
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">{it.text}</span>
                      {it.regions.length === 1 && (
                        <span className="mt-0.5 shrink-0 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-px text-[10px] text-warn">
                          {it.regions[0] === "korea" ? "KR only" : "Global only"}
                        </span>
                      )}
                      {st === "done" && <Check aria-hidden className="mt-1 size-3.5 shrink-0 text-ok" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
