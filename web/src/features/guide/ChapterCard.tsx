import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Compass, Gem, ListChecks, Shield, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IconUrls, RoadmapItem } from "@/lib/types";
import { loadJson, saveJson } from "@/features/keybinds/activeBuild";
import { SkillIcon } from "@/features/keybinds/SkillIcon";
import { cn } from "@/lib/utils";
import { chapterRange, itemsInChapter, type Chapter, type Fact } from "./chapters";

const DONE_KEY = "aion2c.guide.done.v1";

function Section({ icon: Icon, title, children }: { icon: typeof Gem; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
        <Icon aria-hidden className="size-3.5" /> {title}
      </h4>
      {children}
    </div>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5 text-sm">
    {items.map((t) => (
      <li key={t} className="flex gap-2">
        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold-lo" />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

export function FactItem({ f }: { f: Fact }) {
  return (
    <li className="flex gap-2 text-sm">
      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold-lo" />
      <span>
        {f.text}
        {f.check && (
          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-px align-middle text-[10px] text-warn" title={f.check}>
            <AlertTriangle aria-hidden className="size-2.5" /> unconfirmed
          </span>
        )}
        {f.check && <span className="mt-0.5 block text-xs text-faint">{f.check}</span>}
      </span>
    </li>
  );
}

/** Skill names this class unlocks inside the chapter's level range, parsed from the engine road map text. */
export function classSkills(items: RoadmapItem[], chapter: Chapter): { level: number; name: string }[] {
  const out: { level: number; name: string }[] = [];
  for (const it of itemsInChapter(items, chapter)) {
    if (it.kind !== "skill") continue;
    const body = it.text.replace(/^.*skill unlock:\s*/i, "").replace(/^Unlock\s+/i, "");
    for (const part of body.split(",")) {
      const name = part.replace(/\(passive\)/i, "").trim();
      if (name) out.push({ level: it.level, name });
    }
  }
  return out;
}

export function ChapterCard({
  chapter,
  index,
  open,
  onToggle,
  current,
  items,
  icons,
  skillKeys,
  classLabel,
}: {
  chapter: Chapter;
  index: number;
  open: boolean;
  onToggle: () => void;
  current: boolean;
  items: RoadmapItem[];
  icons: IconUrls;
  skillKeys: Map<string, string>;
  classLabel: string;
}) {
  const [done, setDone] = useState<Record<string, boolean>>(() => loadJson(DONE_KEY, {}));
  const toggle = (k: string) =>
    setDone((d) => {
      const n = { ...d, [k]: !d[k] };
      saveJson(DONE_KEY, n);
      return n;
    });
  const skills = classSkills(items, chapter);
  const doneCount = chapter.done.filter((_, i) => done[`${chapter.id}:${i}`]).length;
  const panelId = `panel-${chapter.id}`;

  return (
    <section
      id={`chapter-${chapter.id}`}
      aria-labelledby={`h-${chapter.id}`}
      className={cn("scroll-mt-36 sm:scroll-mt-24 ornate border-border-soft", current ? "border-gold shadow-[0_0_0_3px_rgb(224_180_88/0.12)]" : "border-border-soft")}
    >
      <h3 id={`h-${chapter.id}`} className="m-0">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="flex w-full items-start gap-3 rounded-xl p-3.5 text-left sm:p-4">
          <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold", current ? "border-gold bg-gold text-gold-ink" : "border-border bg-surface2 text-dim")}>
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold sm:text-lg">{chapter.title}</span>
              {current && <Badge tone="gold">You are here</Badge>}
              <Badge className="tabular-nums">Lv {chapterRange(chapter)}</Badge>
            </span>
            <span className="mt-0.5 block text-sm text-dim">{chapter.goal}</span>
          </span>
          <ChevronDown aria-hidden className={cn("mt-1 size-5 shrink-0 text-dim transition-transform", open && "rotate-180")} />
        </button>
      </h3>

      {open && (
        <div id={panelId} className="space-y-5 border-t border-border-soft p-3.5 sm:p-4">
          <div className="grid gap-5 md:grid-cols-2">
            <Section icon={Unlock} title="What unlocks">
              <ul className="space-y-1.5">
                {chapter.unlocks.map((f) => (
                  <FactItem key={f.text} f={f} />
                ))}
              </ul>
            </Section>
            <Section icon={Compass} title="What to focus on">
              <Bullets items={chapter.focus} />
            </Section>
            <Section icon={Shield} title="Gear to aim for">
              <p className="text-sm">{chapter.gear}</p>
            </Section>
            <Section icon={AlertTriangle} title="Common mistakes">
              <Bullets items={chapter.mistakes} />
            </Section>
          </div>

          {skills.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gold">{classLabel} skills in this band</h4>
              <ul className="flex flex-wrap gap-1.5">
                {skills.slice(0, 16).map((s) => {
                  const key = skillKeys.get(s.name.toLowerCase());
                  return (
                    <li key={`${s.level}-${s.name}`} className="flex items-center gap-1.5 frame py-1 pl-1 pr-2 text-xs">
                      <SkillIcon url={key ? icons[key] : null} name={s.name} size={24} />
                      <span>{s.name}</span>
                      <span className="text-faint tabular-nums">Lv {s.level}</span>
                    </li>
                  );
                })}
                {skills.length > 16 && <li className="self-center text-xs text-faint">+{skills.length - 16} more in the Codex</li>}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border-soft bg-bg/50 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
              <ListChecks aria-hidden className="size-3.5" /> Done when
              <span className="ml-auto font-normal normal-case text-faint">
                {doneCount} of {chapter.done.length}
              </span>
            </h4>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {chapter.done.map((t, i) => {
                const k = `${chapter.id}:${i}`;
                return (
                  <li key={k}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} className="mt-1 size-4 shrink-0 accent-[#e0b458]" />
                      <span className={cn(done[k] && "text-faint line-through")}>{t}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            {chapter.tools.map((t) => (
              <Link key={t.to} to={t.to} className="inline-flex items-center rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-gold no-underline hover:border-gold">
                {t.label}
              </Link>
            ))}
            <Link to="/roadmap" className="inline-flex items-center rounded-md px-3 py-1.5 text-sm text-cyan">
              See it on the road map
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
