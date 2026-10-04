import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CharacterBuild } from "@/lib/types";
import { chapterForLevel, chapterRange, GLOBAL_CAP } from "./chapters";
import { capFor, nextMilestones, nextSteps } from "./personal";
import type { GuideData } from "./useGuideData";

const levelOnly = (level: number): CharacterBuild =>
  ({ name: "", region: "global", level, skill_ranks: {}, stigmas: [], specs: {}, stats: {} as CharacterBuild["stats"], show_kr: false, daevanion_nodes: [], skill_points: null, stigma_points: null, class_key: "", bonus_ranks: {} });

/** Personal panel at the top of the guide: where you are, what opens next, the 3 best next steps. */
export function YouAreHere({ data }: { data: GuideData }) {
  const [typed, setTyped] = useState("");
  const n = Math.floor(Number(typed));
  const typedLevel = typed.trim() && n >= 1 ? Math.min(GLOBAL_CAP, n) : null;
  const known = !!data.build;
  const build = data.build ?? (typedLevel ? levelOnly(typedLevel) : null);

  if (!build) {
    return (
      <section aria-labelledby="here-h" className="ornate p-4">
        <h2 id="here-h" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin aria-hidden className="size-5 text-gold" /> Where are you in the journey?
        </h2>
        <p className="mt-1 text-sm text-dim">Load your character and this guide shows your level, your next unlocks and your three best next steps. Or just tell it your level.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link to="/" className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-3.5 text-sm font-semibold text-gold-ink no-underline hover:bg-gold-hi">
            <Search aria-hidden className="size-4" /> Load my character
          </Link>
          <label className="flex items-center gap-2 text-sm text-dim">
            My level
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={GLOBAL_CAP}
              value={typed}
              placeholder="1-45"
              onChange={(e) => setTyped(e.target.value)}
              className="h-9 w-20 game-input px-2.5 text-sm text-foreground "
            />
          </label>
        </div>
      </section>
    );
  }

  const level = build.level;
  const cap = capFor(build);
  const chapter = chapterForLevel(level);
  const nexts = nextMilestones(level);
  const steps = nextSteps(build, data.boards, known);
  return (
    <section aria-labelledby="here-h" className="ornate border-gold p-4 shadow-[0_0_0_4px_rgb(224_180_88/0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="here-h" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin aria-hidden className="size-5 text-gold" /> You are here: level {level}
        </h2>
        {known && <Badge tone="gold">{build.name}</Badge>}
        {known && <Badge>{build.class_key}</Badge>}
        <Link to={`/guide?chapter=${chapter.id}`} className="ml-auto text-sm text-cyan">
          Chapter: {chapter.hi === Infinity ? "Endgame" : `Levels ${chapterRange(chapter)}`}
        </Link>
      </div>
      <div role="progressbar" aria-label="Level progress" aria-valuemin={1} aria-valuemax={cap} aria-valuenow={Math.min(level, cap)} className="xp-bar mt-3">
        <div className="xp-fill" style={{ width: `${(Math.min(level, cap) / cap) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-faint">
        Level {level} of {cap}
        {build.region === "korea" ? " (Korea)" : " (global cap)"}
        {!known && " - based on the level you typed"}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Next unlocks</h3>
          {nexts.length === 0 ? (
            <p className="text-sm text-dim">Everything on the global road map is open. Look at the endgame chapter.</p>
          ) : (
            <ul className="space-y-1.5">
              {nexts.map((m) => (
                <li key={m.level} className="flex items-start gap-2 text-sm">
                  <Badge tone="info" className="shrink-0 tabular-nums">
                    Lv {m.level}
                  </Badge>
                  <span>
                    {m.text} <span className="text-faint">({m.level - level} level{m.level - level === 1 ? "" : "s"} away)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Your 3 next steps</h3>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-2.5 text-sm">
                <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-bold text-gold-ink">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <strong className="block font-medium">{s.title}</strong>
                  <span className="block text-xs text-dim">{s.detail}</span>
                  <Link to={s.to} className="inline-flex items-center gap-1 text-xs text-cyan">
                    {s.linkLabel} <ArrowRight aria-hidden className="size-3" />
                  </Link>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
