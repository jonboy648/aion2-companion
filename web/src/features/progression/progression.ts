import raw from "./data.json";
import { decodeProgression, type ExpandedAcquisitionRank, type ExpandedProgression } from "./decodeProgression";
import type { CharacterBuild, GameData, Priority, Region } from "@/lib/types";

export interface EarnedPoints { skill: number; stigma: number; daevanion: number }
export interface LevelBudget extends EarnedPoints { level: number; stigmaSlots: number }
export type AcquisitionRank = ExpandedAcquisitionRank;
export type Acquisition = ExpandedProgression["classes"][string]["skills"][string];
export type ProgressionData = ExpandedProgression;

export const progression = decodeProgression(raw);
export const NO_EARNED_POINTS: EarnedPoints = { skill: 0, stigma: 0, daevanion: 0 };

export function levelBudget(level: number, region: Region = "global"): LevelBudget | null {
  if (region !== "global" || !Number.isInteger(level)) return null;
  return progression.levels.find((row) => row.level === level) ?? null;
}

export function prepareLevelBuild(input: CharacterBuild, gd: GameData, earned: EarnedPoints, stigmaUnlocked: boolean, daevanionUnlocked = false) {
  const baseline = levelBudget(input.level, input.region);
  if (!baseline) throw new Error("No verified progression budget for this level and region.");
  for (const n of Object.values(earned)) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 10000) throw new Error("Earned points must be whole numbers from 0 to 10000.");
  }
  const acquisitions = progression.classes[input.class_key]?.skills;
  if (!acquisitions || gd.class_key !== input.class_key) throw new Error("Class progression data is not ready.");
  const skill_ranks = Object.fromEntries(Object.entries(acquisitions)
    .filter(([key, acq]) => acq.autoLearn && acq.unlockLevel <= input.level && gd.skills[key] && gd.skills[key].kind !== "stigma")
    .map(([key]) => [key, 1]));
  const budget = { skill: baseline.skill + earned.skill, stigma: baseline.stigma + earned.stigma, daevanion: baseline.daevanion + earned.daevanion };
  return {
    build: { ...input, skill_ranks, stigmas: [], specs: {}, bonus_ranks: {}, daevanion_nodes: [], skill_points: budget.skill, stigma_points: stigmaUnlocked ? budget.stigma : 0, stigma_unlocked: stigmaUnlocked },
    budget,
    daevanionPoints: daevanionUnlocked ? budget.daevanion : 0,
    stigmaUnlocked,
  };
}

/** Validate fresh plans, not an armory character whose earned bonuses are already known. */
export function validateLevelPlan(build: CharacterBuild, budget: EarnedPoints, stigmaUnlocked: boolean, gd: GameData): string[] {
  const acqs = progression.classes[build.class_key]?.skills;
  const baseline = levelBudget(build.level, build.region);
  if (!acqs || !baseline) return ["Progression data is unavailable for this plan."];
  const issues: string[] = [];
  if (gd.class_key !== build.class_key) return ["Class data does not match this plan."];
  if (Object.values(build.bonus_ranks).some((rank) => rank !== 0)) issues.push("Fresh plans cannot assume unprovided gear or Soul Binding bonus ranks.");
  let skillSpent = 0;
  let stigmaSpent = 0;
  if (build.stigmas.length && !stigmaUnlocked) issues.push("Stigma acquisition requires the stigma unlock quest and ascension progress.");
  if (build.stigmas.length > baseline.stigmaSlots) issues.push("Too many stigma slots for this level.");
  if (new Set(build.stigmas).size !== build.stigmas.length) issues.push("Duplicate equipped stigmas.");
  const ranks = { ...build.skill_ranks };
  for (const key of build.stigmas) {
    if (gd.skills[key]?.kind !== "stigma") issues.push(`${key}: equipped skill is not a stigma.`);
    ranks[key] ??= 1;
  }
  for (const [key, rank] of Object.entries(ranks)) {
    const acquisition = acqs[key];
    if (!gd.skills[key]) issues.push(`${key}: missing class skill data.`);
    if (!acquisition) {
      issues.push(`Unresolved paid skill: ${key}.`);
      continue;
    }
    if (!Number.isInteger(rank) || rank < 1 || !acquisition.ranks.some((r) => r.rank === rank)) {
      issues.push(`${key}: invalid paid rank ${rank}.`);
      continue;
    }
    for (const step of acquisition.ranks.filter((r) => r.rank <= rank)) {
      if (step.characterLevel > build.level) issues.push(`${key}: rank ${step.rank} needs level ${step.characterLevel}.`);
      if (step.unresolved) issues.push(`${key}: unresolved acquisition requirements.`);
      if ((step.requiresStigmaUnlock || step.stigmaCost) && !stigmaUnlocked) issues.push(`${key}: stigma acquisition is locked.`);
      if (step.ascensionGrade && !step.requiresStigmaUnlock) issues.push(`${key}: unresolved ascension progress.`);
      if (step.requires.some((p) => (ranks[p.skill] ?? 0) < p.rank)) issues.push(`${key}: missing prerequisite rank.`);
      skillSpent += step.skillCost;
      stigmaSpent += step.stigmaCost;
    }
  }
  if (skillSpent > budget.skill) issues.push(`Skill plan costs ${skillSpent} points; ${budget.skill} available.`);
  if (stigmaSpent > budget.stigma) issues.push(`Stigma plan costs ${stigmaSpent} points; ${budget.stigma} available.`);
  if (gd) {
    for (const key of new Set([...Object.keys(build.specs), ...build.stigmas])) {
      const options = build.specs[key] ?? [];
      const skill = gd.skills[key];
      const nodeBonus = Object.values(gd.daevanion).filter((board) => board.unlock_level <= build.level)
        .flatMap((board) => build.daevanion_nodes.map((id) => board.nodes[String(id)]))
        .filter((node) => node?.skill_key === key).length;
      const cap = skill ? Math.min(skill.ranks.length, gd.rank_caps[build.region][skill.kind === "stigma" ? "stigma" : "core"]) : 0;
      const rank = Math.min(cap, (ranks[key] ?? 0) + Math.min(4, nodeBonus) + Math.max(0, build.bonus_ranks[key] ?? 0));
      if (!skill || new Set(options).size !== options.length || options.some((option) => !Number.isInteger(option) || !skill.specializations[option] || (skill.specializations[option].rank_required ?? Infinity) > rank)) {
        issues.push(`${key}: invalid or locked specialty option.`);
      }
      if (skill && skill.kind !== "stigma" && options.length > progression.specialtySlots.core.filter((slot) => rank >= slot.rank).length) {
        issues.push(`${key}: too many mastery specialty slots.`);
      }
      if (skill?.kind === "stigma") {
        const tiers = acqs[key]?.specialtyAutoSlots ?? [];
        const active = tiers.filter((slot) => rank >= slot.rank);
        const expected = active.map((slot) => slot.slot - 1);
        if (active.some((slot) => skill.specializations[slot.slot - 1]?.rank_required !== slot.rank)) {
          issues.push(`${key}: unresolved automatic stigma tiers.`);
        } else if (options.length !== expected.length || expected.some((option) => !options.includes(option))) {
          issues.push(`${key}: automatic stigma tiers must include every unlocked tier.`);
        }
      }
    }
    const selected = new Set(build.daevanion_nodes);
    let spent = 0;
    if (selected.size !== build.daevanion_nodes.length) issues.push("Duplicate Daevanion nodes.");
    for (const id of selected) {
      const board = Object.values(gd.daevanion).find((b) => b.nodes[String(id)]);
      if (!board || board.unlock_level > build.level) {
        issues.push(`Daevanion node ${id}: unavailable at this level.`);
        continue;
      }
      const currency = progression.classes[build.class_key]?.boardCurrencies[board.key];
      if (currency === "battle") issues.push("Battle Crystal nodes need a separate earned budget.");
      else if (currency !== "daevanion") issues.push(`Daevanion board ${board.key}: unresolved currency.`);
      spent += board.nodes[String(id)].cost;
      const reached = new Set<number>([board.start_id]);
      const queue = [board.start_id];
      for (let i = 0; i < queue.length; i++) {
        for (const next of board.nodes[String(queue[i])]?.adjacent ?? []) {
          if (selected.has(next) && !reached.has(next)) { reached.add(next); queue.push(next); }
        }
      }
      if (!reached.has(id)) issues.push(`Daevanion node ${id}: disconnected from the board start.`);
    }
    if (spent > budget.daevanion) issues.push(`Daevanion plan costs ${spent} points; ${budget.daevanion} available.`);
  }
  return [...new Set(issues)];
}

/** A legal rank allocation does not guarantee that the returned rotation uses only available skills. */
export function validateLevelPriority(build: CharacterBuild, priority: Priority, gd: GameData): string[] {
  const acqs = progression.classes[build.class_key]?.skills ?? {};
  function unavailable(key: string, seen = new Set<string>()): boolean {
    if (seen.has(key)) return true;
    seen.add(key);
    const skill = gd.skills[key];
    if (!skill || !skill.regions.includes(build.region) || (skill.unlock_level ?? 0) > build.level) return true;
    const rule = gd.rules[key];
    if (rule?.requires_spec && !build.specs[rule.requires_spec[0]]?.includes(rule.requires_spec[1])) return true;
    if (skill.kind === "stigma" && !build.stigmas.includes(key)) return true;
    const acquisition = acqs[key];
    if (acquisition) {
      const first = acquisition.ranks.find((row) => row.rank === 1);
      const paidRank = build.skill_ranks[key] ?? (skill.kind === "stigma" && build.stigmas.includes(key) ? 1 : 0);
      return !first || first.unresolved === true || first.characterLevel > build.level
        || ((first.requiresStigmaUnlock || first.stigmaCost > 0) && build.stigma_unlocked !== true)
        || !Number.isInteger(paidRank) || paidRank < 1;
    }
    // Only explicit class-data links can establish a child. An unjoined row stays unavailable.
    const owners = gd.links.filter((link) => link.child_key === key && link.confidence === "confirmed"
      && ["chain", "charge", "proc"].includes(link.kind));
    return owners.length !== 1 || unavailable(owners[0].parent_key, seen);
  }
  return priority.entries.filter((entry) => unavailable(entry.skill_key))
    .map((entry) => `${entry.skill_key}: rotation skill unavailable or ownership unresolved at this level.`);
}
