import { Link } from "react-router-dom";
import { SkillIcon } from "@/features/build/SkillIcon";
import type { CharacterBuild, GameData, IconUrls } from "@/lib/types";
import { guideRanks } from "./guideRanks";
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
  const stigmas = [...new Set(currentPlan?.stigmas ?? [])].flatMap((key) => {
    const skill = gd.skills[key];
    if (!skill || skill.kind !== "stigma" || !skill.regions.includes("global")
      || (skill.unlock_level ?? 0) > level) return [];
    return [{ key, skill, unlockLevel: skill.unlock_level ?? 0 }];
  });
  const effectiveRanks = currentPlan ? guideRanks({ ...gd,
    daevanion: Object.fromEntries(Object.entries(gd.daevanion).filter(([, board]) => board.unlock_level <= level)),
  }, { ...currentPlan,
    bonus_ranks: Object.fromEntries(Object.entries(currentPlan.bonus_ranks)
      .filter(([, bonus]) => Number.isFinite(bonus) && bonus >= 0)),
  }) : {};

  function rows(entries: typeof skills, future = false) {
    return entries.map(({ key, skill, unlockLevel }) => {
      const rank = future ? undefined : currentPlan?.skill_ranks[key];
      const cap = Math.min(gd.rank_caps.global[skill.kind === "stigma" ? "stigma" : "core"], skill.max_rank);
      const hasRank = rank !== undefined && Number.isInteger(rank) && rank > 0
        && rank <= cap;
      const effectiveRank = hasRank ? effectiveRanks[key] : undefined;
      const bonus = hasRank ? effectiveRanks[key] - rank : 0;
      const specialties = hasRank ? [...new Set(currentPlan?.specs[key] ?? [])]
        .filter((option) => Number.isInteger(option) && option >= 0 && skill.specializations[option]?.text.trim()) : [];
      const metadata = `${skill.kind === "stigma" ? "Stigma" : skill.kind === "passive" ? "Passive" : "Active"} / ${future ? "Unlocks" : "Unlocked"} at level ${unlockLevel}`;
      return (
        <li key={key} className="guide-skills-row">
          <Link to={`/codex/${encodeURIComponent(gd.class_key)}?skill=${encodeURIComponent(key)}`}
            className="guide-skills-head">
            <SkillIcon name={skill.name} url={icons[key]} size={36} rarity="common" className="guide-skills-icon" />
            <span className="guide-skills-copy">
              <span className="guide-skills-name">{skill.name}</span>
              {!hasRank && <span className="guide-skills-metadata">{metadata}</span>}
            </span>
            {hasRank && <span className="guide-skills-level">Lv {effectiveRank}</span>}
          </Link>
          {(bonus > 0 || specialties.length > 0) && (
            <div className="guide-skills-details">
              {bonus > 0 && <p className="guide-skills-ranks">Paid {rank} + Bonus {bonus}</p>}
              {specialties.length > 0 && (
                <ul className="guide-skills-specialties" aria-label={`Selected specialties for ${skill.name}`}>
                  {specialties.map((option) => <li key={option}>{skill.specializations[option].text}</li>)}
                </ul>
              )}
            </div>
          )}
        </li>
      );
    });
  }

  return (
    <section aria-label="Core skills" className="reference-panel guide-skills">
      <h2 className="reference-panel-heading guide-skills-heading">Skills</h2>
      <div className="reference-panel-body guide-skills-body">
        <p className="guide-skills-availability">Available at level {level} ({available.length})</p>
        <ul aria-label={`Core skills at level ${level}`} className="guide-skills-list">
          {rows(available)}
        </ul>
        {available.length === 0 && <p className="text-sm text-dim">No core skills available at this level.</p>}
        {stigmas.length > 0 && (
          <section aria-label="Equipped stigmas" className="guide-skills-group">
            <h3 className="guide-skills-group-heading">Stigmas</h3>
            <ul aria-label="Equipped stigma skills" className="guide-skills-list">{rows(stigmas)}</ul>
          </section>
        )}
        {upcoming.length > 0 && (
          <div className="guide-skills-group">
            <h3 className="guide-skills-group-heading">Next unlock / Level {nextLevel}</h3>
            <ul aria-label={`Core skills unlocking at level ${nextLevel}`} className="guide-skills-list">
              {rows(upcoming, true)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
