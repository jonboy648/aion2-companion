import { Link } from "react-router-dom";
import { SkillIcon } from "@/features/build/SkillIcon";
import type { GameData, IconUrls } from "@/lib/types";
import { levelBudget, progression } from "./progression";

interface Props {
  gd: GameData;
  icons: IconUrls;
  level: number;
}

export function GuideSkills({ gd, icons, level }: Props) {
  const skills = Object.entries(progression.classes[gd.class_key]?.skills ?? {}).flatMap(([key, acquisition]) => {
    const skill = gd.skills[key];
    const first = acquisition.ranks.find((rank) => rank.rank === 1);
    if (!skill || !skill.regions.includes("global") || !["active", "passive"].includes(skill.kind)
      || !acquisition.autoLearn || !first || first.unresolved || first.requires.length > 0
      || first.ascensionGrade || first.requiresStigmaUnlock || first.skillCost > 0 || first.stigmaCost > 0) return [];
    const unlockLevel = Math.max(acquisition.unlockLevel, first.characterLevel, skill.unlock_level ?? 0);
    if (!levelBudget(unlockLevel) || unlockLevel > gd.level_caps.global) return [];
    return [{ key, skill, unlockLevel }];
  }).sort((a, b) => a.unlockLevel - b.unlockLevel || a.skill.name.localeCompare(b.skill.name));
  const validLevel = levelBudget(level) !== null && level <= gd.level_caps.global;
  const available = validLevel ? skills.filter((skill) => skill.unlockLevel <= level) : [];
  const nextLevel = validLevel ? skills.find((skill) => skill.unlockLevel > level)?.unlockLevel : undefined;
  const upcoming = skills.filter((skill) => skill.unlockLevel === nextLevel);

  function rows(entries: typeof skills, future = false) {
    return entries.map(({ key, skill, unlockLevel }) => (
      <li key={key} className="min-w-0">
        <Link to={`/codex/${encodeURIComponent(gd.class_key)}?skill=${encodeURIComponent(key)}`}
          className="flex h-full min-w-0 items-center gap-3 rounded-md border border-[color:var(--metal)]/20 bg-surface px-3 py-2.5 text-foreground transition-colors hover:border-cyan/50 hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan">
          <SkillIcon name={skill.name} url={icons[key]} size={40} rarity={future ? "common" : "rare"} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{skill.name}</span>
            <span className="mt-0.5 block text-xs leading-4 text-dim">
              {skill.kind === "passive" ? "Passive" : "Active"}
              {future ? ` / Unlocks at level ${unlockLevel}` : ` / Unlocked at level ${unlockLevel}`}
            </span>
          </span>
        </Link>
      </li>
    ));
  }

  return (
    <section aria-label="Core skills" className="@container mb-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold leading-6 text-foreground">Core skills</h2>
        <span className="text-xs text-gold">Available at level {level} ({available.length})</span>
      </div>
      <ul aria-label={`Core skills at level ${level}`} className="grid grid-cols-1 gap-2 @min-[400px]:grid-cols-2">
        {rows(available)}
      </ul>
      {available.length === 0 && <p className="text-sm text-dim">No core skills available at this level.</p>}
      {upcoming.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium leading-5 text-dim">Next unlock / Level {nextLevel}</h3>
          <ul aria-label={`Core skills unlocking at level ${nextLevel}`} className="grid grid-cols-1 gap-2 @min-[400px]:grid-cols-2">
            {rows(upcoming, true)}
          </ul>
        </div>
      )}
    </section>
  );
}
