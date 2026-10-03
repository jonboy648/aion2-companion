import type { RoadmapItem } from "@/lib/types";

export interface LevelGroup {
  level: number;
  items: RoadmapItem[];
}

export type GroupState = "done" | "current" | "next" | "later";

/** Group already-sorted (or unsorted) items by level, ascending. */
export function groupByLevel(items: RoadmapItem[]): LevelGroup[] {
  const m = new Map<number, RoadmapItem[]>();
  for (const it of items) m.set(it.level, [...(m.get(it.level) ?? []), it]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([level, its]) => ({ level, items: its }));
}

/**
 * The character's current band is the stretch between the last level that is already unlocked (level <= yours)
 * and the next one still ahead. `current` = that last unlocked group, `next` = the first group above your level.
 */
export function groupStates(groups: LevelGroup[], level: number): GroupState[] {
  let currentIdx = -1;
  groups.forEach((g, i) => {
    if (g.level <= level) currentIdx = i;
  });
  return groups.map((_, i) => (i < currentIdx ? "done" : i === currentIdx ? "current" : i === currentIdx + 1 ? "next" : "later"));
}

export interface Progress {
  unlocked: number;
  total: number;
  nextLevel: number | null;
  levelsToNext: number | null;
}

export function progress(items: RoadmapItem[], level: number): Progress {
  const unlocked = items.filter((i) => i.level <= level).length;
  const ahead = items.filter((i) => i.level > level).map((i) => i.level);
  const nextLevel = ahead.length ? Math.min(...ahead) : null;
  return { unlocked, total: items.length, nextLevel, levelsToNext: nextLevel == null ? null : nextLevel - level };
}

export const KIND_LABEL: Record<RoadmapItem["kind"], string> = {
  skill: "Skill",
  zone: "Zone",
  system: "System",
  stigma: "Stigma",
  gear: "Gear",
  daevanion: "Daevanion",
};
