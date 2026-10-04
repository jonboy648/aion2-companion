import { boardSelection, boardTotal } from "@/features/daevanion/logic";
import type { CharacterBuild, DaevanionBoard } from "@/lib/types";
import { GLOBAL_CAP, KOREA_CAP } from "./chapters";

export const STIGMA_SLOT_LEVELS = [22, 27, 32, 37];

export interface Milestone {
  level: number;
  text: string;
  chapter: string;
}

/** Cross-class unlocks (research/data_contract.md section 5). Class-specific skill unlocks come from the engine road map. */
export const MILESTONES: Milestone[] = [
  { level: 5, text: "Wings and Daeva ascension (Elyos; Asmodian at 6)", chapter: "lv-1-10" },
  { level: 10, text: "Crafting and Sealed Dungeon tier 1", chapter: "lv-10-20" },
  { level: 12, text: "Daevanion board 1: Nezekan", chapter: "lv-10-20" },
  { level: 20, text: "Daevanion board 2: Zikel and Krao Cave Exploration", chapter: "lv-20-30" },
  { level: 22, text: "Stigmas and stigma slot 1", chapter: "lv-20-30" },
  { level: 27, text: "Stigma slot 2", chapter: "lv-20-30" },
  { level: 28, text: "Urugugu Canyon Exploration", chapter: "lv-20-30" },
  { level: 30, text: "Daevanion board 3: Vaizel and the Daily Dungeon", chapter: "lv-30-40" },
  { level: 32, text: "Stigma slot 3", chapter: "lv-30-40" },
  { level: 35, text: "Fire Temple Exploration", chapter: "lv-30-40" },
  { level: 37, text: "Stigma slot 4", chapter: "lv-30-40" },
  { level: 40, text: "Daevanion board 4: Triniel", chapter: "lv-40-45" },
  { level: 45, text: "Daevanion board 5: Azphel, end of the story, Conquest modes, Draupnir", chapter: "endgame" },
];

export const nextMilestones = (level: number, n = 3): Milestone[] => MILESTONES.filter((m) => m.level > level).slice(0, n);

export const capFor = (build: Pick<CharacterBuild, "region">): number => (build.region === "korea" ? KOREA_CAP : GLOBAL_CAP);

/** Skill points needed to take one skill from rank 1 to `rank` (1 for ranks 2-4, 2 for 5-7, 4 for 8-10). */
export function skillPointCost(rank: number): number {
  let total = 0;
  for (let r = 2; r <= Math.min(rank, 10); r++) total += r <= 4 ? 1 : r <= 7 ? 2 : 4;
  return total;
}

export interface BoardProgress {
  key: string;
  name: string;
  unlockLevel: number;
  open: boolean;
  used: number;
  total: number;
}

export function boardProgress(boards: Record<string, DaevanionBoard>, build: CharacterBuild): BoardProgress[] {
  const sel = new Set(build.daevanion_nodes);
  return Object.values(boards)
    .sort((a, b) => a.unlock_level - b.unlock_level)
    .map((b) => ({
      key: b.key,
      name: b.name,
      unlockLevel: b.unlock_level,
      open: build.level >= b.unlock_level,
      used: boardSelection(b, sel).length,
      total: boardTotal(b),
    }));
}

export interface Step {
  id: string;
  title: string;
  detail: string;
  to: string;
  linkLabel: string;
}

/** The three most useful next actions for this character. Pure; boards may be empty while game data loads. */
export function nextSteps(build: CharacterBuild, boards: BoardProgress[], known = true): Step[] {
  const steps: Step[] = [];
  const level = build.level;
  const ranks = Object.values(build.skill_ranks);
  const below10 = ranks.filter((r) => r < 10).length;

  // 1. skills
  if (build.skill_points != null && build.skill_points > 0) {
    steps.push({ id: "skills", title: `Spend your ${build.skill_points} unspent skill points`, detail: "Open the Skill window (K). Finish your main skills first: rank 8 opens a specialty slot, rank 10 is the direct cap.", to: "/codex", linkLabel: "See what each skill does" });
  } else if (!known || ranks.length === 0) {
    steps.push({ id: "skills", title: "Spend any unspent skill points", detail: "Open the Skill window (K). Finish your main skills first: rank 8 opens a specialty slot, rank 10 is the direct cap.", to: "/codex", linkLabel: "See what each skill does" });
  } else if (below10 > 0) {
    steps.push({ id: "skills", title: "Spend any unspent skill points", detail: `${below10} of your ${ranks.length} ranked skills are below rank 10. Rank 8 opens a specialty slot, rank 10 is the direct cap. Check the Skill window (K) for leftover points.`, to: "/codex", linkLabel: "See what each skill does" });
  } else {
    steps.push({ id: "skills", title: "Push skills past rank 10", detail: "Ranks above 10 come from Daevanion nodes, Arcana cards and Soul Binding.", to: "/daevanion", linkLabel: "Daevanion planner" });
  }

  // 2. stigmas
  const nextSlot = STIGMA_SLOT_LEVELS.findIndex((l) => l > level);
  const slotsOpen = nextSlot === -1 ? STIGMA_SLOT_LEVELS.length : nextSlot;
  if (nextSlot !== -1) {
    const n = STIGMA_SLOT_LEVELS[nextSlot];
    steps.push({ id: "stigma", title: `Your next stigma slot opens at level ${n}`, detail: slotsOpen === 0 ? "Stigmas unlock at level 22." : `${slotsOpen} of 4 slots are open. ${n - level} level${n - level === 1 ? "" : "s"} to go.`, to: "/codex", linkLabel: "Codex: stigmas by class" });
  } else if (!known) {
    steps.push({ id: "stigma", title: "Keep all 4 stigma slots filled", detail: "Your class guide lists the four to take.", to: "/codex", linkLabel: "Codex: stigmas by class" });
  } else if (build.stigmas.length < slotsOpen) {
    steps.push({ id: "stigma", title: `Fill your empty stigma slots (${build.stigmas.length} of 4 used)`, detail: "Your class guide lists the four to take.", to: "/codex", linkLabel: "Codex: stigmas by class" });
  } else {
    steps.push({ id: "stigma", title: "All 4 stigma slots are full: raise your main stigma", detail: "Put Stigma Shards into the stigma your build leads with, up to rank 20 on global.", to: "/build", linkLabel: "My Build" });
  }

  // 3. Daevanion
  const openBoards = (known ? boards : []).filter((b) => b.open && b.used < b.total);
  if (openBoards.length) {
    const b = [...openBoards].sort((a, c) => a.used / a.total - c.used / c.total)[0];
    steps.push({ id: "daevanion", title: `Daevanion: ${b.name} board ${b.used}/${b.total} open`, detail: "Sealed Dungeon clears give points. Add nodes next to ones you own.", to: "/daevanion", linkLabel: "Daevanion planner" });
  } else {
    const nextBoard = boards.find((b) => !b.open);
    steps.push({
      id: "daevanion",
      title: !known ? "Spend your Daevanion points" : nextBoard ? `Daevanion: ${nextBoard.name} board opens at level ${nextBoard.unlockLevel}` : "Daevanion: check your boards",
      detail: "Open boards fill from Sealed Dungeon points.",
      to: "/daevanion",
      linkLabel: "Daevanion planner",
    });
  }

  if (level >= capFor(build)) {
    steps.unshift({ id: "optimize", title: "You are at the level cap: find your next upgrade", detail: "The build optimizer ranks the stat and skill upgrades that add the most damage.", to: "/build", linkLabel: "Open My Build" });
  }
  return steps.slice(0, 3);
}
