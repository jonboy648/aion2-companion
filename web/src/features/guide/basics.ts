import type { Fact } from "./chapters";

export type Difficulty = "Easier" | "Medium" | "Harder";

export interface ClassBlurb {
  key: string;
  name: string;
  role: string;
  difficulty: Difficulty;
  line: string;
}

/** Difficulty is our reading of the community class notes (research/community_builds), not an official rating. */
export const CLASS_BLURBS: ClassBlurb[] = [
  { key: "gladiator", name: "Gladiator", role: "Melee damage", difficulty: "Easier", line: "Frontline fighter with big hits. A short main skill line does most of the work." },
  { key: "templar", name: "Templar", role: "Tank", difficulty: "Easier", line: "The group's shield. Tough, taunts enemies, modest damage." },
  { key: "assassin", name: "Assassin", role: "Melee damage", difficulty: "Harder", line: "Highest single-target burst, but a demanding rotation and fragile. Hit from behind." },
  { key: "ranger", name: "Ranger", role: "Ranged damage", difficulty: "Easier", line: "Safe bow damage from range. Accuracy is the stat to watch." },
  { key: "sorcerer", name: "Sorcerer", role: "Ranged damage", difficulty: "Medium", line: "Fire and ice burst plus area damage that carries dungeons. Fragile; watch your MP." },
  { key: "spiritmaster", name: "Spiritmaster", role: "Support damage", difficulty: "Harder", line: "Summons spirits that fight for you and buffs the party. Buff first, then summon." },
  { key: "cleric", name: "Cleric", role: "Healer", difficulty: "Medium", line: "Main healer, and also has to deal damage. Essential for hard content." },
  { key: "chanter", name: "Chanter", role: "Support", difficulty: "Easier", line: "Buffs the party and heals a little. A group usually wants one." },
];

export interface Control {
  keys: string;
  what: string;
  check?: string;
}

export const CONTROLS: Control[] = [
  { keys: "W A S D", what: "Move" },
  { keys: "1-12", what: "Skill bar slots (rebindable in Settings > Key Settings)" },
  { keys: "Shift", what: "Sprint and dodge" },
  { keys: "Space", what: "Jump and glide" },
  { keys: "V", what: "Start or stop flight (after you get wings)" },
  { keys: "K", what: "Skill window: Active, Passive, Mastery, Stigma, Macro tabs" },
  { keys: "F", what: "Interact" },
  { keys: "C", what: "Mount" },
  { keys: "Tab", what: "Change target" },
  { keys: "Alt (hold)", what: "Show the mouse cursor in the default control mode" },
  { keys: "M / I / J", what: "Map, inventory (Cube), journal (quests)" },
  { keys: "Ctrl+W / Ctrl+S", what: "Fly up / down", check: "Sources disagree (Ctrl+R / Ctrl+F in one). Check Key Settings." },
];

export const IGNORE_EARLY: string[] = [
  "Abyss and Battleground PvP. Learn your class first.",
  "Enhancing gear. You will replace almost everything before 45.",
  "Crafting beyond the first quest. It matters more near the cap.",
  "Macros. Learn each skill by hand before you automate.",
  "Detailed stats such as accuracy and crit caps. Use the build optimizer at 45.",
  "Korea-only content (levels 45-50). The global cap is 45 at launch.",
];

export interface System {
  id: string;
  title: string;
  /** one sentence */
  what: string;
  why: string;
  facts: Fact[];
  tool?: { to: string; label: string };
  /** optional small table rendered under the facts */
  table?: { head: string[]; rows: string[][] };
}

export const SYSTEMS: System[] = [
  {
    id: "skills",
    title: "Skill points and ranks",
    what: "Every skill has a rank. You spend skill points to raise it, up to rank 10 directly.",
    why: "Rank is your damage. It also opens specialty slots, so a few high-rank skills beat many low ones.",
    facts: [
      { text: "21 skill points take one skill from rank 1 to rank 10." },
      { text: "Beyond 10, ranks come from Daevanion (up to +4), Arcana cards and gear Soul Bindings. Rank 20 is the global ceiling.", check: "Sources say 12, 16 or 20 for the ceiling; 20 is what this site uses." },
      { text: "Skill points come from level-ups, main quests and Sealed Dungeons.", check: "NCSOFT has not published the curve." },
    ],
    table: {
      head: ["Rank", "Cost each", "Running total"],
      rows: [
        ["2-4", "1", "3"],
        ["5-7", "2", "9"],
        ["8-10", "4", "21"],
      ],
    },
    tool: { to: "/codex", label: "Codex: every skill and rank" },
  },
  {
    id: "specialties",
    title: "Specialties",
    what: "Each active skill has its own list of 5 specialty options. You equip up to 3 per skill.",
    why: "A specialty can remove a cooldown, add a hit or change how a skill works. It is the cheapest big upgrade.",
    facts: [
      { text: "Slots unlock with skill rank: first at 8, second at 12, third at 16, more at 20." },
      { text: "At rank 8, choose one useful option rather than copying a full 3-option target." },
    ],
    tool: { to: "/codex", label: "Codex: specialties per skill" },
  },
  {
    id: "stigmas",
    title: "Stigmas",
    what: "Stigmas are extra class skills. You get 13 per class and equip up to 4 on the global client.",
    why: "They hold your strongest buffs and your biggest damage. Most builds lead with one stigma at rank 20.",
    facts: [
      { text: "Unlock at level 22. Slots open at 22, 27, 32 and 37." },
      { text: "They use Stigma Shards (Abyss, Shugo Festa, Nightmare shops), not skill points. Global cap is rank 20." },
      { text: "Korea has 6 slots and a rank 25 cap. Ignore that on global." },
    ],
    table: {
      head: ["Stigma rank", "Cost each", "Running total"],
      rows: [
        ["1-5", "1", "5"],
        ["6-10", "2", "15"],
        ["11-15", "4", "35"],
        ["16-20", "8", "75"],
      ],
    },
    tool: { to: "/codex", label: "Codex: stigmas by class" },
  },
  {
    id: "daevanion",
    title: "Daevanion boards",
    what: "Five boards of connected nodes. Each node gives a stat or adds a rank to a skill.",
    why: "It is free power that lasts all game, and it is where skill ranks above 10 come from.",
    facts: [
      { text: "Boards open at levels 12, 20, 30, 40 and 45. Each is named for a god: Nezekan, Zikel, Vaizel, Triniel, Azphel." },
      { text: "Node costs: Common 1, Rare 2, Epic 3, Unique 4 points. All five boards cost 802 points together." },
      { text: "A node must touch your centre or a node you already own. Diagonals do not count.", check: "Inferred from a third-party planner, not tested in game." },
      { text: "Sealed Dungeon clears give 2 Daevanion Crystals each." },
    ],
    tool: { to: "/daevanion", label: "Daevanion planner" },
  },
  {
    id: "gear",
    title: "Gear and enchanting",
    what: "Gear comes in grades: Common, Rare, Epic, Unique. You enhance a piece with Enhance Stones and Kinah.",
    why: "At the cap, gear is most of your power. Knowing which piece is worth enhancing saves a lot of Kinah.",
    facts: [
      { text: "Enhancement caps: Common +5, Rare +5, Epic +10, Unique +15." },
      { text: "Unique +10 to +15 can fail (65 / 50 / 35 / 25 / 20%) but gains a pity bonus and does not break the item." },
      { text: "Manastones (4 slots on Unique) and Soul Binding (Unique only, random stats) add more." },
      { text: "Per-piece item level (54-102 at the cap) is not your character item level (the total used for dungeon gates)." },
    ],
    tool: { to: "/build", label: "My Build: best upgrade next" },
  },
  {
    id: "macros",
    title: "The in-game macro",
    what: "Open the Skill window (K) and the Macro tab. Bind a key and hold it to loop a list of skills.",
    why: "It lets you keep the rotation going with one held key. It is a legal built-in feature.",
    facts: [
      { text: "Holding the key loops the list and skips skills on cooldown or without mana." },
      { text: "A hotbar slot can stack up to 4 skills. The bottom cell is priority 0: a press fires the lowest usable skill in the stack, so put your most important skill at the bottom and no-cooldown fillers at the top. A macro holds up to 20 entries." },
      { text: "A 10 ms delay is the recommended default." },
      { text: "Do not use hardware or mouse macros (Logitech G HUB, Razer Synapse). NCSOFT bans them.", check: "Penalty details differ by source; global policy not found." },
    ],
    tool: { to: "/keybinds", label: "Keybinds and macro builder" },
  },
  {
    id: "crafting",
    title: "Crafting",
    what: "Five professions (Blacksmithing, Armorsmithing, Handicrafting, Alchemy, Cooking) that make gear, accessories, food and Manastones.",
    why: "Crafted Dragon Lord gear (item level 62-102) is a main source of cap gear.",
    facts: [
      { text: "Unlocks at level 10. Mastery runs 1-100 per profession; at 50 an upgrade quest raises the cap." },
      { text: "Profession names differ between sites. Armorsmithing may be called Tailoring and Handicrafting may be called Jewelcrafting.", check: "Naming not settled." },
    ],
    tool: { to: "/crafting", label: "Crafting: recipes and shopping list" },
  },
];

export interface WeeklyRow {
  what: string;
  how: string;
  check?: string;
}

export const WEEKLY: WeeklyRow[] = [
  { what: "Expedition Exploration", how: "7 entries per dungeon per week" },
  { what: "Expedition Conquest", how: "7 entries per dungeon per week" },
  { what: "Transcendence dungeons", how: "Arcana cards; weekly final-boss cap" },
  { what: "Sanctuary Raids", how: "10 players, 4 attempts per week. Ludra opens around item level 2,800" },
  { what: "Ascension Trial and Subjugation", how: "3 per week each" },
  { what: "Abyss PvP", how: "7 hours per layer per week" },
  { what: "Weekly reset", how: "Wednesday; the hour depends on the server", check: "One source says 4 PM server time. Unverified." },
];

export const GEAR_TIERS: { tier: string; il: string; source: string }[] = [
  { tier: "Starter (1-20)", il: "1-20", source: "Common and Rare quest drops" },
  { tier: "Early (20-30)", il: "23-28", source: "Epic field gear" },
  { tier: "Mid (30-40)", il: "36-46", source: "First Unique at level 30, named elites" },
  { tier: "Cap tier 1", il: "54", source: "Conquest: Krao Cave, Draupnir" },
  { tier: "Cap tier 2", il: "70", source: "Conquest: Urugugu Canyon, Vakron Sky Island" },
  { tier: "Cap tier 3", il: "86", source: "Conquest: Fire Temple, Ferocious Horn Den" },
  { tier: "Cap tier 4", il: "102", source: "Ludra raid; crafted Dragon Lord sets 62-102" },
];

export const SOURCES: { label: string; url: string; note: string }[] = [
  { label: "metabot.gg beginners, leveling, dungeon, gear and enhancement guides", url: "https://metabot.gg/en/aion-2/guides/beginners-guide", note: "Global, 2026-10-01. Main source for level unlocks." },
  { label: "metabot.gg stigma guide, dbaion2.ru stigma guide", url: "https://metabot.gg/en/aion-2/guides/stigma-guide", note: "Stigma slots and costs." },
  { label: "allthings.how keybindings, skill and macro guides", url: "https://allthings.how/aion-2-keybindings-how-to-change-and-customize-your-controls/", note: "Controls, skill window, macros." },
  { label: "couga54 Aion 2 guides", url: "https://couga54.github.io/aion2-guides/en/settings/", note: "Settings and class builds." },
  { label: "aion2hub update notes (Korea)", url: "https://aion2hub.com/updates/aion-2-update-2026-07-01", note: "Korea cap 50, stigma cap 25." },
  { label: "Aion 2 Daevanion data (aion2t.com, metaroad.gg)", url: "https://aion2t.com/daevanion", note: "Board layout and costs." },
  { label: "Project research notes", url: "", note: "game_ui_and_progression, mastery_stigma, daevanion_notes, crafting_notes, macros_ingame, gear_data, community_builds." },
];
