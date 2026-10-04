import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ChapterCard } from "@/features/guide/ChapterCard";
import { CHAPTERS, chapterForLevel } from "@/features/guide/chapters";
import { FirstHour } from "@/features/guide/FirstHour";
import { FIRST_HOUR_ID, JourneyStrip } from "@/features/guide/Journey";
import { EndgameOverview, Sources, Systems } from "@/features/guide/Sections";
import { useGuideData } from "@/features/guide/useGuideData";
import { YouAreHere } from "@/features/guide/YouAreHere";

import { SectionTitle } from "@/components/game/SectionTitle";

function Heading({ id, title, caption }: { id: string; title: string; caption?: string }) {
  return (
    <SectionTitle id={id} caption={caption} className="mb-3">
      {title}
    </SectionTitle>
  );
}

export function GuidePage() {
  const data = useGuideData();
  const [params] = useSearchParams();
  const requested = params.get("chapter");
  const level = data.build?.level ?? null;
  const current = level != null ? chapterForLevel(level) : null;

  const [open, setOpen] = useState<Set<string>>(() => new Set([requested && requested !== FIRST_HOUR_ID ? requested : (current ?? CHAPTERS[0]).id]));
  const seededFor = useRef<string | null>(current?.id ?? null);

  // a character that loads after first paint opens its own chapter once
  useEffect(() => {
    if (current && seededFor.current == null && !requested) {
      seededFor.current = current.id;
      setOpen((s) => new Set(s).add(current.id));
    }
  }, [current, requested]);

  // deep links from the stepper and the road map: open the chapter and scroll to it
  useEffect(() => {
    if (!requested) return;
    if (requested !== FIRST_HOUR_ID) setOpen((s) => (s.has(requested) ? s : new Set(s).add(requested)));
    const t = setTimeout(() => document.getElementById(requested === FIRST_HOUR_ID ? FIRST_HOUR_ID : `chapter-${requested}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [requested]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOpen = open.size === CHAPTERS.length;
  const classLabel = data.classes.find((c) => c.key === data.classKey)?.name ?? "Your class";

  return (
    <>
      <PageHeader title="New player guide" caption="Start here. Follow the journey from your first hour to max power. Each chapter says what unlocks, what to focus on and when you are done." />

      <div className="space-y-6">
        <YouAreHere data={data} />
        <JourneyStrip level={level} />

        <section id={FIRST_HOUR_ID} aria-labelledby="first-h" className="scroll-mt-36 sm:scroll-mt-24">
          <Heading id="first-h" title="Your first hour" caption="Pick a class, learn the keys, and skip what does not matter yet." />
          <FirstHour classKey={data.classKey} onPick={data.setClassKey} />
        </section>

        <section aria-labelledby="chapters-h">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <Heading id="chapters-h" title="The journey, level by level" caption={`Tap a chapter to open it. Skills shown are for ${classLabel}.`} />
            <button
              type="button"
              onClick={() => setOpen(allOpen ? new Set() : new Set(CHAPTERS.map((c) => c.id)))}
              className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-dim hover:border-gold hover:text-foreground"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <div className="space-y-3">
            {CHAPTERS.map((c, i) => (
              <ChapterCard
                key={c.id}
                chapter={c}
                index={i}
                open={open.has(c.id)}
                onToggle={() => toggle(c.id)}
                current={current?.id === c.id}
                items={data.roadmapItems}
                icons={data.icons}
                skillKeys={data.skillKeys}
                classLabel={classLabel}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="systems-h">
          <Heading id="systems-h" title="Systems explained simply" caption="Seven things the game never explains well, each with why it matters." />
          <Systems />
        </section>

        <section aria-labelledby="endgame-h">
          <Heading id="endgame-h" title="Endgame overview" caption="What you do at level 45 and how this site helps." />
          <EndgameOverview />
        </section>

        <Sources />
      </div>
    </>
  );
}

export default GuidePage;
