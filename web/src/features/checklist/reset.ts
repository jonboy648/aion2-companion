import { REGIONS, TIMINGS, type RegionKey } from "../timers/data";
import { localYmd, nextOccurrences, zonedToUtc } from "../timers/schedule";

export type ResetKind = "daily" | "weekly";

const DAY = 86_400_000;

function ymdOfDayNum(n: number) {
  const d = new Date(n * DAY);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** Calendar date of an instant in a zone, as whole days since 1970-01-01. */
function dayNumber(ms: number, tz: string): number {
  const { y, m, d } = localYmd(ms, tz);
  return Date.UTC(y, m - 1, d) / DAY;
}

/** Most recent daily or weekly reset at or before `now` (epoch ms), from the shared timer table. */
export function lastReset(kind: ResetKind, region: RegionKey, now: number): number {
  const { tz, schedule } = REGIONS[region];
  const rule = TIMINGS[schedule][kind].rule;
  if (rule.kind === "interval") throw new Error("reset rules are daily or weekly");
  const today = dayNumber(now, tz);
  for (let back = 0; back <= 8; back++) {
    const n = today - back;
    if (rule.kind === "weekly" && !rule.days.includes(new Date(n * DAY).getUTCDay())) continue;
    const { y, m, d } = ymdOfDayNum(n);
    const t = zonedToUtc(y, m, d, rule.atMin, tz);
    if (t <= now) return t;
  }
  throw new Error("no reset found in the last 9 days");
}

/** Next daily or weekly reset after `now`. Same source as the header timer strip. */
export function nextReset(kind: ResetKind, region: RegionKey, now: number): number {
  return nextOccurrences(kind, region, now, 1)[0].start;
}

/**
 * Today's cycle index for the anchor: custom tasks reset every N days, counted in the region's calendar
 * days from the day the task was made, at the daily reset hour.
 */
export function customWindow(everyDays: number, anchorDay: number, region: RegionKey, now: number): { start: number; end: number } {
  const { tz, schedule } = REGIONS[region];
  const rule = TIMINGS[schedule].daily.rule;
  if (rule.kind !== "daily") throw new Error("daily rule expected");
  const n = Math.max(1, Math.floor(everyDays));
  const today = dayNumber(lastReset("daily", region, now), tz); // the day the current daily cycle began
  const k = Math.max(0, Math.floor((today - anchorDay) / n)) * n;
  const at = (day: number) => {
    const { y, m, d } = ymdOfDayNum(day);
    return zonedToUtc(y, m, d, rule.atMin, tz);
  };
  const start = Math.min(at(anchorDay + k), lastReset("daily", region, now));
  return { start, end: at(anchorDay + k + n) };
}

/** Calendar-day anchor for a custom task made at `now`: the day of the current daily cycle. */
export function anchorDayFor(region: RegionKey, now: number): number {
  return dayNumber(lastReset("daily", region, now), REGIONS[region].tz);
}
