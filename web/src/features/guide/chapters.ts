import type { RoadmapItem } from "@/lib/types";

/** A fact; `check` marks it as conflicting or single-source and says why. */
export interface Fact {
  text: string;
  check?: string;
}

export interface Tool {
  to: string;
  label: string;
}

export interface Chapter {
  id: string;
  /** inclusive lower bound, exclusive upper bound (endgame: hi = Infinity) */
  lo: number;
  hi: number;
  title: string;
  /** one line a newcomer can hold on to */
  goal: string;
  unlocks: Fact[];
  focus: string[];
  gear: string;
  mistakes: string[];
  done: string[];
  tools: Tool[];
}

export const GLOBAL_CAP = 45;
export const KOREA_CAP = 50;

export const CHAPTERS: Chapter[] = [
  {
    id: "lv-1-10",
    lo: 1,
    hi: 10,
    title: "Levels 1-10: learn your toolkit",
    goal: "Follow the story, get your wings, and learn the five or six skills that make up your class.",
    unlocks: [
      { text: "Starting zone: Poeta (Elyos) or Ishalgen (Asmodian), levels 1-9." },
      { text: "Wings and Daeva ascension at level 5 (Elyos) or 6 (Asmodian). This opens flight.", check: "One KR-era site says level 10; the newer global guides say 5/6." },
      { text: "A new class skill almost every level. Your class list is in the chapter below." },
      { text: "Level 10: you move on to Verteron / Altgard, and crafting and Sealed Dungeon tier 1 unlock." },
    ],
    focus: [
      "Follow the main story. Episode quests give nearly all the EXP you need up to 45 (about 97% for Elyos, 99% for Asmodian).",
      "Put your first skills on the bar and learn to dodge (Shift). Practice before dungeons, not in them.",
      "Spend skill points on the 3 to 4 skills you use most, not on everything.",
    ],
    gear: "Quest drops (Common and Rare) are all you need. Wear the highest item level you find and move on.",
    mistakes: [
      "Spreading skill points one by one across every skill. Rank 8 is where a skill's first specialty slot opens, so finish a few skills first.",
      "Enhancing gear you will replace within minutes.",
      "Skipping story quests to grind. The story is the fastest EXP.",
    ],
    done: ["You reached level 10", "Wings are unlocked and you have flown once", "Your core skills are on the hotbar", "You arrived in Verteron / Altgard"],
    tools: [
      { to: "/codex", label: "Codex: read what each skill does" },
      { to: "/keybinds", label: "Keybinds: set up your bar" },
    ],
  },
  {
    id: "lv-10-20",
    lo: 10,
    hi: 20,
    title: "Levels 10-20: Sealed Dungeons and your first Daevanion",
    goal: "Start clearing Sealed Dungeons. They feed your skill points and your Daevanion board.",
    unlocks: [
      { text: "Sealed Dungeons: solo instances with no entry limit, tiers at levels 10, 15, 20, 25, 30, 35, 40 and 45." },
      { text: "Crafting specialty quest appears at level 10." },
      { text: "Level 12: Daevanion board 1 (Nezekan)." },
      { text: "Level 20: Daevanion board 2 (Zikel) and Krao Cave Exploration (needs item level 200)." },
    ],
    focus: [
      "Clear Sealed Dungeons as they open. Each clear gives 2 Daevanion Crystals (points), 2 Wisdom Stones, 15,000 Kinah and crafting materials.",
      "At level 12, open the Daevanion planner and spend your first points. Grow outward from the centre; a node must touch one you already own.",
      "Bring your main damage skills to rank 8 and pick one specialty for each.",
    ],
    gear: "Still starter gear (item level 1-20 per piece). Around level 20, Epic field gear (item level 23-28) starts dropping.",
    mistakes: [
      "Ignoring Sealed Dungeons. They are solo, safe and the main Daevanion point source.",
      "Taking three specialties 'to try'. At rank 8 one good option beats a copied full setup.",
    ],
    done: ["You reached level 20", "Nezekan board has points in it", "Core skills at rank 8 with one specialty each", "You cleared the tier 1 and tier 2 Sealed Dungeons"],
    tools: [
      { to: "/daevanion", label: "Daevanion planner" },
      { to: "/crafting", label: "Crafting: recipes and shopping list" },
    ],
  },
  {
    id: "lv-20-30",
    lo: 20,
    hi: 30,
    title: "Levels 20-30: stigmas",
    goal: "Unlock stigmas at 22 and pour your first shards into one strong stigma.",
    unlocks: [
      { text: "Level 22: stigma skills (13 per class) and stigma slot 1. A quest is part of the unlock.", check: "Earlier sources said level 35; the newest global guide and three more say 22." },
      { text: "Level 27: stigma slot 2." },
      { text: "Level 28: Urugugu Canyon Exploration (item level 300)." },
      { text: "Level 30: Daevanion board 3 (Vaizel) and the Daily Dungeon." },
    ],
    focus: [
      "Stigmas use Stigma Shards, not skill points. Pick the stigma your class build leads with and raise that one first (levels 1-5 cost 1 each, 6-10 cost 2, 11-15 cost 4, 16-20 cost 8).",
      "Keep spending Daevanion points as Sealed Dungeons give them.",
      "Use the Codex to see which stigmas your class guide recommends.",
    ],
    gear: "Epic field gear, item level 23-28 per piece. Replace pieces as upgrades drop.",
    mistakes: [
      "Splitting stigma shards evenly. One stigma at rank 10 or 20 is stronger than four at rank 5.",
      "Treating stigmas as optional. They carry a lot of your damage or survival.",
    ],
    done: ["You reached level 30", "One stigma is equipped and ranked up", "Nezekan and Zikel boards are growing", "You tried the Daily Dungeon"],
    tools: [
      { to: "/codex", label: "Codex: stigmas by class" },
      { to: "/daevanion", label: "Daevanion planner" },
    ],
  },
  {
    id: "lv-30-40",
    lo: 30,
    hi: 40,
    title: "Levels 30-40: fill your stigma slots",
    goal: "Open all four stigma slots and turn your core skills into a real rotation.",
    unlocks: [
      { text: "Level 32: stigma slot 3. Level 37: stigma slot 4 (the global maximum)." },
      { text: "Level 35: Fire Temple Exploration (item level 500)." },
      { text: "Level 40: Daevanion board 4 (Triniel)." },
      { text: "Crafting: Novice mastery is 1-50, then an upgrade quest at 50 raises the cap to 100." },
    ],
    focus: [
      "Fill each stigma slot as it opens with the stigmas your class guide lists.",
      "Raise main skills toward rank 10 (21 skill points per skill in total) and keep Daevanion points going.",
      "Try the in-game macro once your rotation feels natural. See 'Systems explained'.",
    ],
    gear: "Mid gear, item level 36-46 per piece. Your first Unique piece (item level 36) can drop around level 30 from named elites.",
    mistakes: [
      "Enhancing mid-level Unique gear past +10. You will replace it at 45.",
      "Building a macro before you know what each skill does.",
    ],
    done: ["You reached level 40", "All unlocked stigma slots are filled", "Triniel board is open", "Main skills at rank 10 or close"],
    tools: [
      { to: "/keybinds", label: "Keybinds and macros" },
      { to: "/crafting", label: "Crafting" },
      { to: "/daevanion", label: "Daevanion planner" },
    ],
  },
  {
    id: "lv-40-45",
    lo: 40,
    hi: 45,
    title: "Levels 40-45: finish the story, get ready for the cap",
    goal: "Finish the main story, open the last Daevanion board and prepare to enter Conquest content.",
    unlocks: [
      { text: "Level 45 (global cap): Daevanion board 5 (Azphel), end of the story, all Conquest modes and Draupnir." },
      { text: "Stigma points come faster now (roughly 2 per level from 40).", check: "Single source (metabot.gg) plus one stigma guide." },
    ],
    focus: [
      "Finish the main story quest line. It ends at level 45.",
      "Spend every spare Daevanion point and check your skill ranks against your class build.",
      "Look up your character item level. Krao Cave Conquest asks for item level 700, so start collecting Exploration and crafted gear.",
    ],
    gear: "Cap gear is item level 54-102 per piece. Conquest drops 54 (Krao Cave, Draupnir), 70 (Urugugu, Vakron), 86 (Fire Temple, Horn Den) and 102 (Ludra raid). Crafted Dragon Lord sets run 62-102.",
    mistakes: [
      "Confusing per-piece item level (54-102) with your character item level (hundreds to thousands). Dungeon gates use the character total.",
      "Burning shards on a stigma you plan to swap later.",
    ],
    done: ["You are level 45", "The story is finished", "All five Daevanion boards are open", "You know which expedition fits your item level"],
    tools: [
      { to: "/build", label: "My Build: stats and next upgrades" },
      { to: "/daevanion", label: "Daevanion planner" },
    ],
  },
  {
    id: "endgame",
    lo: GLOBAL_CAP,
    hi: Infinity,
    title: "Endgame: weekly content and max power",
    goal: "Run weekly dungeons, climb the gear tiers and use the optimizer to find your next upgrade.",
    unlocks: [
      { text: "Expeditions with Exploration and Conquest modes, Transcendence dungeons (Arcana cards), Sanctuary Raids, Ascension Trials, Subjugation, Nightmare bosses." },
      { text: "Abyss and Battleground PvP. The exact global level gates are not confirmed.", check: "Not confirmed for Global." },
      { text: "Korea only: level cap 50, Eltnen and Morheim zones, Pendant slot, stigma cap 25." },
    ],
    focus: [
      "Use your weekly entries: Exploration and Conquest 7 each per dungeon, plus Transcendence, Sanctuary raids, Ascension Trial and Subjugation.",
      "Upgrade gear tier by tier, then enhance (Unique to +15), add Manastones and Soul Binding.",
      "Import your character on the build optimizer to see which stat or skill upgrade gives the most damage.",
    ],
    gear: "Chase the next expedition tier, then crafted Dragon Lord pieces and Enraged Kromede / Nuakum sets. Enhance the piece you will keep.",
    mistakes: [
      "Enhancing a piece you are about to replace.",
      "Chasing item level instead of the stat your class actually needs (for example accuracy for Rangers).",
    ],
    done: ["You use your weekly entries", "You know your class's best stats", "You have a plan for the next gear tier"],
    tools: [
      { to: "/build", label: "Build optimizer" },
      { to: "/keybinds", label: "Keybinds and macros" },
    ],
  },
];

export const chapterForLevel = (level: number): Chapter => CHAPTERS.find((c) => level >= c.lo && level < c.hi) ?? CHAPTERS[0];
export const chapterRange = (c: Chapter): string => (c.hi === Infinity ? `${c.lo}+` : `${c.lo}-${c.hi}`);
export const chapterShort = (c: Chapter): string => (c.hi === Infinity ? "Endgame" : `Lv ${c.lo}-${c.hi}`);

/** Road map items whose level falls inside the chapter. */
export const itemsInChapter = (items: RoadmapItem[], c: Chapter): RoadmapItem[] => items.filter((i) => i.level >= c.lo && i.level < c.hi);
