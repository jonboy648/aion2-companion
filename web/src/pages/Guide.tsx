import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Compass, Layers, Map, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { ChapterCard } from "@/features/guide/ChapterCard";
import { CHAPTERS, chapterForLevel } from "@/features/guide/chapters";
import { FirstHour } from "@/features/guide/FirstHour";
import { FIRST_HOUR_ID, JourneyStrip } from "@/features/guide/Journey";
import { EndgameOverview, Sources, Systems } from "@/features/guide/Sections";
import { useGuideData } from "@/features/guide/useGuideData";
import { YouAreHere } from "@/features/guide/YouAreHere";

import { SectionTitle } from "@/components/game/SectionTitle";
import "@/features/guide/guide-layout.css";

function Heading({ id, title, caption }: { id: string; title: string; caption?: string }) {
  return (
    <SectionTitle id={id} caption={caption} className="mb-3">
      {title}
    </SectionTitle>
  );
}

export function GuidePage() {
  const data = useGuideData();
  const [params, setParams] = useSearchParams();
  const requested = params.get("chapter");
  const level = data.build?.level ?? null;
  const current = level != null ? chapterForLevel(level) : null;
  const requestedView = params.get("view");
  const view = requested ? (requested === FIRST_HOUR_ID ? "first" : "journey") :
    (["first", "journey", "systems"].includes(requestedView ?? "") ? requestedView! : (current ? "journey" : "first"));
  const changeView = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.delete("chapter");
    updated.set("view", next);
    setParams(updated, { preventScrollReset: true });
  };

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
    <div className="start-guide">
      <header className="guide-intro">
        <div className="guide-intro-copy">
          <span className="guide-eyebrow"><Compass size={15} aria-hidden /> Start here</span>
          <PageHeader title="New player guide" caption="Your next step, from your first class to endgame." />
          <div className="guide-shortcuts">
            <Link to="/build"><Sparkles size={16} aria-hidden /> Build my character <ArrowRight size={14} aria-hidden /></Link>
            <Link to="/maps"><Map size={16} aria-hidden /> Explore maps <ArrowRight size={14} aria-hidden /></Link>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <YouAreHere data={data} />
        <Tabs value={view} onValueChange={changeView} className="guide-content">
          <TabsList aria-label="Guide sections" className="guide-tabs">
            <TabsTrigger value="first"><Compass size={17} aria-hidden /> First hour</TabsTrigger>
            <TabsTrigger value="journey"><BookOpen size={17} aria-hidden /> Level journey</TabsTrigger>
            <TabsTrigger value="systems"><Layers size={17} aria-hidden /> Game systems</TabsTrigger>
          </TabsList>

        <TabsContent value="first">
        <section id={FIRST_HOUR_ID} aria-labelledby="first-h" className="scroll-mt-36 sm:scroll-mt-24">
          <Heading id="first-h" title="Your first hour" caption="Pick a class, learn the keys, and skip what does not matter yet." />
          <FirstHour classKey={data.classKey} onPick={data.setClassKey} />
        </section>
        <div className="guide-next">
          <div><strong>Ready for the next milestone?</strong><p>See what unlocks at each level and what to focus on.</p></div>
          <button type="button" onClick={() => changeView("journey")}>Continue to the journey <ArrowRight size={16} aria-hidden /></button>
        </div>
        </TabsContent>

        <TabsContent value="journey">
        <JourneyStrip level={level} className="guide-journey" />
        <section aria-labelledby="chapters-h">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <Heading id="chapters-h" title="The journey, level by level" caption={`Unlocks and priorities for ${classLabel}.`} />
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
        </TabsContent>

        <TabsContent value="systems" className="space-y-8">
        <section aria-labelledby="systems-h">
          <Heading id="systems-h" title="Systems explained simply" caption="Seven things the game never explains well, each with why it matters." />
          <Systems />
        </section>

        <section aria-labelledby="endgame-h">
          <Heading id="endgame-h" title="Endgame overview" caption="What you do at level 45 and how this site helps." />
          <EndgameOverview />
        </section>

        <Sources />
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default GuidePage;
