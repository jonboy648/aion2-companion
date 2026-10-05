import { EVENTS, type EventId, type RegionKey } from "./data";
import {
  currentOccurrence,
  formatShort,
  nextBoss,
  nextBossOccurrences,
  nextOccurrences,
  riftEntryOpen,
  type Occurrence,
} from "./schedule";

export interface Chip {
  id: "shugo" | "rift" | "boss" | "daily";
  label: string;
  /** full text, shown from the sm breakpoint up */
  text: string;
  /** shorter text for phones */
  compact: string;
  /** green: something is happening now */
  active: boolean;
  /** the next 5 occurrences for the dropdown */
  upcoming: Occurrence[];
}

function untilNext(event: EventId, region: RegionKey, now: number): number {
  const next = nextOccurrences(event, region, now, 2).find((o) => o.start > now);
  return next ? next.start - now : 0;
}

/** The four header-strip entries for a region at `now`. Pure; the strip only formats and renders this. */
export function stripChips(region: RegionKey, now: number): Chip[] {
  const shugo = currentOccurrence("shugo", region, now);
  const shugoText = shugo ? `ends ${formatShort(shugo.end - now)}` : formatShort(untilNext("shugo", region, now));

  const rift = currentOccurrence("rift", region, now);
  const open = riftEntryOpen(region, now);
  const riftIn = formatShort(untilNext("rift", region, now));

  const boss = nextBoss(region, now);
  const bossName = EVENTS[boss.occurrence.event].name;
  const bossIn = formatShort(boss.active ? boss.occurrence.end - now : boss.occurrence.start - now);

  return [
    { id: "shugo", label: "Shugo", text: shugoText, compact: shugoText, active: !!shugo, upcoming: nextOccurrences("shugo", region, now, 5) },
    {
      id: "rift",
      label: "Rift",
      text: open ? `portal closes ${formatShort(rift!.entryEnd! - now)}` : riftIn,
      compact: open ? `closes ${formatShort(rift!.entryEnd! - now)}` : riftIn,
      active: open,
      upcoming: nextOccurrences("rift", region, now, 5),
    },
    {
      id: "boss",
      label: bossName,
      text: boss.active ? `ends ${bossIn}` : bossIn,
      compact: boss.active ? `ends ${bossIn}` : bossIn,
      active: boss.active,
      upcoming: nextBossOccurrences(region, now, 5),
    },
    { id: "daily", label: "Daily reset", text: formatShort(untilNext("daily", region, now)), compact: formatShort(untilNext("daily", region, now)), active: false, upcoming: nextOccurrences("daily", region, now, 5) },
  ];
}
