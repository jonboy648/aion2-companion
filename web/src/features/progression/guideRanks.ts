import { skillBonuses } from "@/features/daevanion/logic";
import type { CharacterBuild, GameData } from "@/lib/types";
import { progression } from "./progression";

/** Same rank ownership and bonus sources as models.total_rank; display only. */
export function guideRanks(gd: GameData, build: CharacterBuild): Record<string, number> {
  const bonuses = skillBonuses(gd, new Set(build.daevanion_nodes));
  const parents = Object.fromEntries(gd.links.filter((link) => link.kind === "chain" || link.kind === "upgrade")
    .map((link) => [link.child_key, link.parent_key]));
  const acquisitions = progression.classes[gd.class_key]?.skills ?? {};
  function rank(key: string, visited = new Set<string>()): number {
    const skill = gd.skills[key];
    if (!skill) return 1;
    if (!(key in build.skill_ranks) && skill.kind === "chain" && !acquisitions[key]
      && parents[key] && !visited.has(parents[key])) {
      visited.add(key);
      return rank(parents[key], visited);
    }
    const cap = Math.min(skill.max_rank, gd.rank_caps[build.region][skill.kind === "stigma" ? "stigma" : "core"]);
    const paid = Math.max(1, Math.min(cap, build.skill_ranks[key] ?? 1));
    return Math.max(1, Math.min(cap, paid + Math.max(0, build.bonus_ranks[key] ?? 0) + (bonuses[key] ?? 0)));
  }
  return Object.fromEntries(Object.keys(gd.skills).map((key) => [key, rank(key)]));
}
