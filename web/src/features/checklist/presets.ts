import type { RegionKey } from "../timers/data";
import { addTask, type ChecklistState, type Group } from "./model";

/**
 * Starter packs. EDITABLE: once added, every task can be renamed, re-counted or deleted.
 *
 * Dungeon names come from our own client export, a small hand-picked set with no raw rows:
 *  - DungeonGroup (visible groups: Krao Cave, Draupnir, Urugugu Canyon, Bakron Island, Fire Temple,
 *    Horn Cave, Reforged Abyss; Deus Center and Arkanis are the group dungeons)
 *  - EventSchedule (the Invasion field event, which runs on the timers page)
 * The export does not say how often each dungeon resets or how many entries it gives, so the group
 * each task sits in and every count are best guesses that have not been checked in the game.
 */
export interface PresetTask {
  group: Group;
  title: string;
  target?: number;
  note?: string;
  everyDays?: number;
}

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  tasks: PresetTask[];
}

export const PACKS: Pack[] = [
  {
    id: "dailies",
    name: "Daily essentials",
    blurb: "What most players do before the daily reset.",
    tasks: [
      { group: "daily", title: "Daily quests" },
      { group: "daily", title: "Abyss supply requests", target: 3 },
      { group: "daily", title: "Spend daily dungeon entries", target: 2, note: "Pick the dungeons you need drops from." },
      { group: "daily", title: "Invasion event" },
    ],
  },
  {
    id: "dungeons",
    name: "Dungeon runs",
    blurb: "One line per dungeon from the client's dungeon list, with a run counter.",
    tasks: [
      { group: "daily", title: "Krao Cave" },
      { group: "daily", title: "Draupnir" },
      { group: "daily", title: "Urugugu Canyon" },
      { group: "daily", title: "Bakron Island" },
      { group: "daily", title: "Fire Temple" },
      { group: "daily", title: "Horn Cave" },
      { group: "weekly", title: "Reforged Abyss", target: 3 },
      { group: "weekly", title: "Deus Center", target: 3 },
      { group: "weekly", title: "Arkanis", target: 3 },
    ],
  },
  {
    id: "weeklies",
    name: "Weekly essentials",
    blurb: "Things that refresh on the weekly reset (Wednesday).",
    tasks: [
      { group: "weekly", title: "Weekly quests" },
      { group: "weekly", title: "Weekly Abyss supply requests", target: 3 },
      { group: "weekly", title: "Spend weekly dungeon entries", target: 3 },
      { group: "custom", title: "Check the market for upgrade materials", everyDays: 3 },
    ],
  },
];

/** Add a pack's tasks, skipping any whose group and title are already in the list. */
export function addPack(s: ChecklistState, pack: Pack, region: RegionKey, now: number): ChecklistState {
  let next = s;
  for (const t of pack.tasks) {
    if (next.tasks.some((x) => x.group === t.group && x.title === t.title)) continue;
    next = addTask(next, t, region, now);
  }
  return next;
}
