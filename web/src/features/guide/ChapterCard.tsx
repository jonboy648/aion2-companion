import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronDown, Compass, Gem, ListChecks, Shield, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IconUrls, RoadmapItem } from "@/lib/types";
import { loadJson, saveJson } from "@/features/keybinds/activeBuild";
import { SkillIcon } from "@/features/keybinds/SkillIcon";
import { cn } from "@/lib/utils";
import { chapterRange, itemsInChapter, type Chapter, type Fact } from "./chapters";
import "./chapter-card.css";

const DONE_KEY = "aion2c.guide.done.v1";

function Section({ icon: Icon, title, children }: { icon: typeof Gem; title: string; children: React.ReactNode }) {
  return (
    <div className="chapter-section">
      <h4 className="chapter-section-title">
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
  const skillLevels = [...new Set(skills.map(s => s.level))].sort((a, b) => a - b);
  const primaryTool = chapter.tools.find(t => t.to.startsWith("/daevanion")) ?? chapter.tools[0];

  return (
    <section
      id={`chapter-${chapter.id}`}
      aria-labelledby={`h-${chapter.id}`}
      className={cn("chapter-card scroll-mt-36 sm:scroll-mt-24", current && "chapter-current")}
    >
      <h3 id={`h-${chapter.id}`} className="m-0">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="chapter-toggle">
          <span aria-hidden className="chapter-number">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold sm:text-lg">{chapter.title}</span>
              {current && <Badge tone="gold">You are here</Badge>}
              <Badge className="tabular-nums">Lv {chapterRange(chapter)}</Badge>
            </span>
          </span>
          <ChevronDown aria-hidden className={cn("mt-1 size-5 shrink-0 text-dim transition-transform", open && "rotate-180")} />
        </button>
      </h3>

      {open && (
        <div id={panelId} className="chapter-body">
          <p className="chapter-priority"><Compass size={18} aria-hidden /><span>{chapter.goal}</span></p>
          <div className="chapter-columns">
            <div className="space-y-6">
            <Section icon={Unlock} title="What unlocks">
              <ul className="chapter-unlocks">
                {chapter.unlocks.map((f) => (
                  <li key={f.text}>
                    <span className="chapter-unlock-text">{f.text}</span>
                    {f.check && <details className="chapter-source-note"><summary><AlertTriangle size={12} aria-hidden /> Unconfirmed unlock</summary><p>{f.check}</p></details>}
                  </li>
                ))}
              </ul>
            </Section>
            <Section icon={Shield} title="Gear to aim for">
              <p className="text-sm text-dim">{chapter.gear}</p>
            </Section>
            </div>
            <div className="space-y-6">
            <Section icon={Compass} title="Your priorities">
              <ol className="chapter-actions">{chapter.focus.map((text, i) => <li key={text}><span aria-hidden>{i + 1}</span><p>{text}</p></li>)}</ol>
            </Section>
            <details className="chapter-mistakes"><summary><AlertTriangle size={15} aria-hidden /> Common mistakes <ChevronDown size={14} aria-hidden /></summary>
              <Bullets items={chapter.mistakes} />
            </details>
            </div>
          </div>

          {skills.length > 0 && (
            <div className="chapter-skills">
              <h4 className="chapter-section-title">{classLabel} skills in this band <span className="text-faint font-normal">{skills.length} unlocks</span></h4>
              {skillLevels.map(level => <div key={level} className="chapter-skill-group"><h5>Level {level}</h5><ul>
                {skills.filter(s => s.level === level).map((s) => {
                  const key = skillKeys.get(s.name.toLowerCase());
                  return (
                    <li key={`${s.level}-${s.name}`}>
                      <SkillIcon url={key ? icons[key] : null} name={s.name} size={24} />
                      <span>{s.name}</span>
                    </li>
                  );
                })}
              </ul></div>)}
            </div>
          )}

          <div className="chapter-completion">
            <h4 className="chapter-section-title">
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
                    <label className="chapter-check">
                      <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} className="mt-1 size-4 shrink-0 accent-[#e0b458]" />
                      <span className={cn(done[k] && "text-faint line-through")}>{t}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="chapter-tools">
            {primaryTool && <Link to={primaryTool.to} className="chapter-primary-tool">{primaryTool.label}<ArrowRight size={16} aria-hidden /></Link>}
            {chapter.tools.filter(t => t !== primaryTool).map((t) => (
              <Link key={t.to} to={t.to}>
                {t.label}
              </Link>
            ))}
            <Link to="/roadmap">
              See it on the road map
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
