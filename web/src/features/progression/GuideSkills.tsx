import { Link } from "react-router-dom";
import { SkillIcon } from "@/features/build/SkillIcon";
import type { CharacterBuild, GameData, IconUrls } from "@/lib/types";
import { levelBudget, progression } from "./progression";
import "./GuideSkills.css";

interface Props {
  gd: GameData;
  icons: IconUrls;
  level: number;
  /** The parent supplies only a validated calculation for the current inputs. */
  plannedBuild?: CharacterBuild;
}

export function GuideSkills({ gd, icons, level, plannedBuild }: Props) {
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
  const currentPlan = validLevel && plannedBuild?.class_key === gd.class_key
    && plannedBuild.region === "global" && plannedBuild.level === level ? plannedBuild : undefined;

  function rows(entries: typeof skills, future = false) {
    return entries.map(({ key, skill, unlockLevel }) => {
      const rank = future ? undefined : currentPlan?.skill_ranks[key];
      const hasRank = rank !== undefined && Number.isInteger(rank) && rank > 0
        && rank <= Math.min(gd.rank_caps.global.core, skill.max_rank);
      const specialties = hasRank ? [...new Set(currentPlan?.specs[key] ?? [])]
        .filter((option) => Number.isInteger(option) && option >= 0 && skill.specializations[option]) : [];
      const metadata = `${skill.kind === "passive" ? "Passive" : "Active"} / ${future ? "Unlocks" : "Unlocked"} at level ${unlockLevel}`;
      return (
        <li key={key} className="min-w-0">
          <Link to={`/codex/${encodeURIComponent(gd.class_key)}?skill=${encodeURIComponent(key)}`}
            className="guide-skills-row">
            <SkillIcon name={skill.name} url={icons[key]} size={32} rarity={future ? "common" : "rare"} />
            <span className="guide-skills-copy">
              <span className="guide-skills-name" title={skill.name}>{skill.name}</span>
              <span className="guide-skills-metadata" title={metadata}>{metadata}</span>
            </span>
            {hasRank && (
              <span className="guide-skills-badges">
                <span className="guide-skills-badge" title={`Calculated rank ${rank}`}>Rank {rank}</span>
                {specialties.length > 0 && (
                  <span className="guide-skills-badge guide-skills-specialties"
                    aria-label={`Specialties ${specialties.map((option) => option + 1).join(", ")}`}
                    title={specialties.map((option) => `Specialty ${option + 1}: ${skill.specializations[option].text}`).join("\n")}>
                    Specs {specialties.map((option) => option + 1).join(", ")}
                  </span>
                )}
              </span>
            )}
          </Link>
        </li>
      );
    });
  }

  return (
    <section aria-label="Core skills" className="guide-skills mb-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold leading-6 text-foreground">Core skills</h2>
        <span className="text-xs text-gold">Available at level {level} ({available.length})</span>
      </div>
      <ul aria-label={`Core skills at level ${level}`} className="guide-skills-list">
        {rows(available)}
      </ul>
      {available.length === 0 && <p className="text-sm text-dim">No core skills available at this level.</p>}
      {upcoming.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium leading-5 text-dim">Next unlock / Level {nextLevel}</h3>
          <ul aria-label={`Core skills unlocking at level ${nextLevel}`} className="guide-skills-list">
            {rows(upcoming, true)}
          </ul>
        </div>
      )}
    </section>
  );
}
