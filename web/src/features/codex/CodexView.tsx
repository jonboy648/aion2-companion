import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { gamedata, iconUrls, listClasses } from "@/engine/api";
import type { ClassInfo, GameData, IconUrls, Skill } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SkillDrawer } from "./SkillDrawer";
import { ConfidenceBadge, ElementDot, SkillIcon } from "./parts";
import { cardLine, filterSkills, KIND_FILTERS, KIND_LABEL, kindCounts, type KindFilter } from "./logic";

const ROLE_LABEL: Record<string, string> = { melee_dps: "Melee DPS", ranged_dps: "Ranged DPS", tank: "Tank", healer: "Healer", support: "Support" };

interface Loaded {
  gd: GameData;
  icons: IconUrls;
}

export function CodexView({ classKey }: { classKey: string }) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const openKey = params.get("skill");

  useEffect(() => {
    listClasses().then(setClasses, () => setClasses([]));
  }, []);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    Promise.all([gamedata(classKey), iconUrls(classKey)]).then(
      ([gd, icons]) => live && setData({ gd, icons }),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [classKey]);

  const skills = useMemo(() => (data ? filterSkills(data.gd, kind, query) : []), [data, kind, query]);
  const counts = useMemo(() => (data ? kindCounts(data.gd) : null), [data]);
  const open: Skill | null = data && openKey ? data.gd.skills[openKey] ?? null : null;

  const select = useCallback(
    (key: string | null) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (key) next.set("skill", key);
          else next.delete("skill");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return (
    <div className="space-y-4">
      <nav aria-label="Classes" className="flex flex-wrap gap-1.5">
        {classes.map((c) => (
          <Link
            key={c.key}
            to={`/codex/${c.key}`}
            aria-current={c.key === classKey ? "page" : undefined}
            title={ROLE_LABEL[c.role] ?? c.role}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm no-underline transition-colors",
              c.key === classKey ? "border-gold bg-surface3 text-gold" : "border-border-soft bg-surface text-dim hover:bg-surface2 hover:text-foreground",
            )}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills, tags, descriptions"
            aria-label="Search skills"
            className="pl-8"
          />
        </div>
        <div role="group" aria-label="Skill type" className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key}
              aria-pressed={kind === f.key}
              onClick={() => setKind(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                kind === f.key ? "border-gold bg-gold/15 text-gold" : "border-border-soft bg-surface text-dim hover:bg-surface2 hover:text-foreground",
              )}
            >
              {f.label}
              {counts && <span className="ml-1.5 tabular-nums text-faint">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-error">
          Could not load {classKey}: {error}
        </p>
      )}
      {!data && !error && <p className="text-dim">Loading skills...</p>}
      {data && skills.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-dim">
          No skills match. <button className="text-cyan hover:underline" onClick={() => (setQuery(""), setKind("all"))}>Clear filters</button>
        </div>
      )}
      {data && skills.length > 0 && (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Skills">
          {skills.map((s) => (
            <li key={s.key}>
              <SkillCard skill={s} icon={data.icons[s.key]} onOpen={() => select(s.key)} />
            </li>
          ))}
        </ul>
      )}
      {data && open && <SkillDrawer skill={open} gd={data.gd} icons={data.icons} onClose={() => select(null)} onSelect={select} />}
    </div>
  );
}

function SkillCard({ skill, icon, onOpen }: { skill: Skill; icon: string | null | undefined; onOpen: () => void }) {
  const line = cardLine(skill);
  const conf = skill.ranks[0]?.cooldown_s.confidence ?? skill.atk_ratio_pct.confidence;
  return (
    <button
      onClick={onOpen}
      className="flex h-full w-full items-start gap-3 ornate p-3 text-left transition-colors hover:border-gold-lo hover:bg-surface2 focus-visible:border-gold"
    >
      <SkillIcon url={icon} name={skill.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{skill.name}</span>
          <ElementDot element={skill.element} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={skill.kind === "stigma" ? "info" : skill.kind === "active" ? "gold" : "neutral"}>{KIND_LABEL[skill.kind]}</Badge>
          {skill.max_rank > 1 && <Badge>Rank {skill.max_rank}</Badge>}
          {skill.unlock_level != null && <Badge>Lv {skill.unlock_level}</Badge>}
          <ConfidenceBadge confidence={conf} />
        </span>
        {line && <span className="mt-1 block text-xs text-dim">{line}</span>}
      </span>
    </button>
  );
}
