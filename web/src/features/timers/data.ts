/**
 * Game event schedule table. The one place to correct times.
 *
 * COMMUNITY-SOURCED SCHEDULE, UNVERIFIED IN GAME. These times come from community
 * trackers, not from NCSOFT or from our own testing. Check them in the client and
 * fix the numbers here; everything on the site is computed from this table.
 *
 * All times are local clock times in the region's time zone. Days: 0=Sun .. 6=Sat.
 */

export type RegionKey = "global" | "kr" | "tw";
export type ScheduleKey = "global" | "nc";

export interface RegionInfo {
  label: string;
  tz: string;
  schedule: ScheduleKey;
}

/** KR and TW run the same "nc" schedule on their own clocks. */
export const REGIONS: Record<RegionKey, RegionInfo> = {
  global: { label: "Global", tz: "UTC", schedule: "global" },
  kr: { label: "KR", tz: "Asia/Seoul", schedule: "nc" },
  tw: { label: "TW", tz: "Asia/Taipei", schedule: "nc" },
};
export const REGION_KEYS = Object.keys(REGIONS) as RegionKey[];

export type EventId = "rift" | "shugo" | "daily" | "weekly" | "kaira" | "artifact" | "siegeBosses" | "nahma" | "invasion";

export interface EventInfo {
  id: EventId;
  name: string;
  /** compact label for the header strip */
  short: string;
  description: string;
  /** counts as a "boss" for the header's next-boss slot */
  boss?: boolean;
}

export const EVENTS: Record<EventId, EventInfo> = {
  rift: {
    id: "rift",
    name: "Spacetime Rift",
    short: "Rift",
    description: "A timed rift run. The entry portal is only open for the first 10 minutes of each hour-long window.",
  },
  shugo: {
    id: "shugo",
    name: "Shugo Festival",
    short: "Shugo",
    description: "A short festival event that comes round every hour and lasts 10 minutes.",
  },
  // From our own client export (EventSchedule table); duration unknown, so only the start is shown. Unverified in game.
  invasion: {
    id: "invasion",
    name: "Invasion",
    short: "Invasion",
    description: "Hourly invasion event that starts at half past the hour. How long it lasts is not known yet.",
  },
  daily: { id: "daily", name: "Daily reset", short: "Daily reset", description: "Daily quests and limits refresh." },
  weekly: {
    id: "weekly",
    name: "Weekly reset",
    short: "Weekly reset",
    description: "Weekly quests and limits refresh on Wednesday.",
  },
  kaira: {
    id: "kaira",
    name: "Watcher Kaira",
    short: "Kaira",
    description: "Field boss that spawns at a random location in Lower Reshanta.",
    boss: true,
  },
  artifact: {
    id: "artifact",
    name: "Artifact Siege",
    short: "Artifact Siege",
    description: "Siege over the artifact. The winner gets the Abyss Corridor.",
  },
  siegeBosses: {
    id: "siegeBosses",
    name: "Siege Bosses",
    short: "Siege bosses",
    description:
      "Lower Reshanta: Executors Tamasa, Argo and Kaira. Middle Reshanta: Executioner Dramos, Turncoat Ducal and Ravager Marakha.",
    boss: true,
  },
  nahma: {
    id: "nahma",
    name: "Guardian Lord Nahma",
    short: "Nahma",
    description: "Guardian lord that appears in Lower and Middle Reshanta.",
    boss: true,
  },
};
export const EVENT_ORDER: EventId[] = ["shugo", "invasion", "rift", "kaira", "siegeBosses", "artifact", "nahma", "daily", "weekly"];

export type Rule =
  | { kind: "interval"; everyMin: number; fromMin: number } // fromMin = minutes after local midnight
  | { kind: "daily"; atMin: number }
  | { kind: "weekly"; days: number[]; atMin: number };

export interface Timing {
  rule: Rule;
  /** how long the event lasts; 0 for resets and point spawns */
  durationMin: number;
  /** rift only: the portal is open for this many minutes from the start */
  entryMin?: number;
}

const hm = (h: number, m = 0) => h * 60 + m;

export const TIMINGS: Record<ScheduleKey, Record<EventId, Timing>> = {
  global: {
    rift: { rule: { kind: "interval", everyMin: 180, fromMin: hm(0) }, durationMin: 60, entryMin: 10 },
    shugo: { rule: { kind: "interval", everyMin: 60, fromMin: hm(0) }, durationMin: 10 },
    invasion: { rule: { kind: "interval", everyMin: 60, fromMin: hm(0, 30) }, durationMin: 0 },
    daily: { rule: { kind: "daily", atMin: hm(16) }, durationMin: 0 },
    weekly: { rule: { kind: "weekly", days: [3], atMin: hm(16) }, durationMin: 0 },
    kaira: { rule: { kind: "interval", everyMin: 180, fromMin: hm(2) }, durationMin: 0 },
    artifact: { rule: { kind: "weekly", days: [1, 4, 6], atMin: hm(21) }, durationMin: 30 },
    siegeBosses: { rule: { kind: "weekly", days: [1, 4, 6], atMin: hm(21, 30) }, durationMin: 30 },
    nahma: { rule: { kind: "weekly", days: [0, 5], atMin: hm(19) }, durationMin: 30 },
  },
  nc: {
    rift: { rule: { kind: "interval", everyMin: 180, fromMin: hm(2) }, durationMin: 60, entryMin: 10 },
    shugo: { rule: { kind: "interval", everyMin: 60, fromMin: hm(0) }, durationMin: 10 },
    invasion: { rule: { kind: "interval", everyMin: 60, fromMin: hm(0, 30) }, durationMin: 0 },
    daily: { rule: { kind: "daily", atMin: hm(5) }, durationMin: 0 },
    weekly: { rule: { kind: "weekly", days: [3], atMin: hm(5) }, durationMin: 0 },
    kaira: { rule: { kind: "interval", everyMin: 240, fromMin: hm(1) }, durationMin: 0 },
    artifact: { rule: { kind: "weekly", days: [3, 6], atMin: hm(21, 20) }, durationMin: 30 },
    siegeBosses: { rule: { kind: "weekly", days: [3, 6], atMin: hm(21, 45) }, durationMin: 30 },
    nahma: { rule: { kind: "weekly", days: [0, 5], atMin: hm(22) }, durationMin: 30 },
  },
};
