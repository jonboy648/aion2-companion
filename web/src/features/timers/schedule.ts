import { EVENTS, EVENT_ORDER, REGIONS, TIMINGS, type EventId, type RegionKey, type Rule } from "./data";

const MIN = 60_000;

export interface Occurrence {
  event: EventId;
  /** epoch ms */
  start: number;
  /** epoch ms; equals start for resets and point spawns */
  end: number;
  /** rift: epoch ms when the entry portal closes */
  entryEnd?: number;
}

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a time zone, read back as if they were UTC fields (ms). */
function wallAsUtc(ms: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const part of dtf(tz).formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Local calendar date of an instant in a time zone. */
export function localYmd(ms: number, tz: string): Ymd {
  const d = new Date(wallAsUtc(ms, tz));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/**
 * The instant at which the wall clock in `tz` reads the given local time (minutes after
 * midnight). Handles DST because the offset is read from Intl at the target instant, not
 * assumed. A wall time skipped by a spring-forward gap has no exact instant; the result there is only approximate.
 */
export function zonedToUtc(y: number, m: number, d: number, minutes: number, tz: string): number {
  const asUtc = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = asUtc - (wallAsUtc(asUtc, tz) - asUtc);
  guess = asUtc - (wallAsUtc(guess, tz) - guess); // refine: the offset may differ at the target
  return guess;
}

function addDays({ y, m, d }: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Local start minutes of an event on one local calendar day. */
function startsOnDay(rule: Rule, day: Ymd): number[] {
  switch (rule.kind) {
    case "daily":
      return [rule.atMin];
    case "weekly":
      return rule.days.includes(new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()) ? [rule.atMin] : [];
    case "interval": {
      const out: number[] = [];
      for (let t = rule.fromMin % rule.everyMin; t < 1440; t += rule.everyMin) out.push(t);
      return out;
    }
  }
}

/** Occurrences starting on local days from yesterday to `days` ahead of `now`, sorted by start. */
function scan(event: EventId, region: RegionKey, now: number, days: number): Occurrence[] {
  const { tz, schedule } = REGIONS[region];
  const timing = TIMINGS[schedule][event];
  const today = localYmd(now, tz);
  const out: Occurrence[] = [];
  for (let i = -1; i <= days; i++) {
    const day = addDays(today, i);
    for (const atMin of startsOnDay(timing.rule, day)) {
      const start = zonedToUtc(day.y, day.m, day.d, atMin, tz);
      const occ: Occurrence = { event, start, end: start + timing.durationMin * MIN };
      if (timing.entryMin) occ.entryEnd = start + timing.entryMin * MIN;
      out.push(occ);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The next `n` occurrences that have not ended yet; one in progress comes first. */
export function nextOccurrences(event: EventId, region: RegionKey, now: number, n: number): Occurrence[] {
  const { rule } = TIMINGS[REGIONS[region].schedule][event];
  const perDay = rule.kind === "weekly" ? rule.days.length / 7 : rule.kind === "daily" ? 1 : 1440 / rule.everyMin;
  const days = Math.ceil(n / perDay) + 8;
  return scan(event, region, now, days)
    .filter((o) => (o.end > o.start ? o.end > now : o.start > now))
    .slice(0, n);
}

/** The occurrence running at `now`, if any. Resets and point spawns are never active. */
export function currentOccurrence(event: EventId, region: RegionKey, now: number): Occurrence | null {
  return scan(event, region, now, 0).find((o) => o.start <= now && now < o.end) ?? null;
}

/** Rift only: true while the entry portal of the running rift is open. */
export function riftEntryOpen(region: RegionKey, now: number): boolean {
  const cur = currentOccurrence("rift", region, now);
  return !!cur && cur.entryEnd !== undefined && now < cur.entryEnd;
}

export interface BossSlot {
  occurrence: Occurrence;
  active: boolean;
}

/** The boss event running now, otherwise the one starting soonest (Kaira, siege bosses, Nahma). */
export function nextBoss(region: RegionKey, now: number): BossSlot {
  const all = EVENT_ORDER.filter((e) => EVENTS[e].boss).flatMap((e) => nextOccurrences(e, region, now, 1));
  const running = all.find((o) => o.start <= now && now < o.end);
  if (running) return { occurrence: running, active: true };
  return { occurrence: all.sort((a, b) => a.start - b.start)[0], active: false };
}

/** The next `n` boss occurrences across Kaira, siege bosses and Nahma, in time order. */
export function nextBossOccurrences(region: RegionKey, now: number, n: number): Occurrence[] {
  return EVENT_ORDER.filter((e) => EVENTS[e].boss)
    .flatMap((e) => nextOccurrences(e, region, now, n))
    .sort((a, b) => a.start - b.start)
    .slice(0, n);
}

/** Countdown text: "2d 3h", "3h 05m", "4m 12s", "9s". Negative input counts as zero. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Header-strip countdown: minutes only once past a minute ("50m", "1h 50m", "23h 50m"), seconds under a minute ("21s"). */
export function formatShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** The rule in the region's own clock, e.g. "Every 3 h from 02:00" or "Mon, Thu, Sat at 21:00". */
export function describeRule(event: EventId, region: RegionKey): string {
  const { rule } = TIMINGS[REGIONS[region].schedule][event];
  const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (rule.kind === "daily") return `Every day at ${clock(rule.atMin)}`;
  if (rule.kind === "weekly") return `${rule.days.map((d) => DAYS[d]).join(", ")} at ${clock(rule.atMin)}`;
  const every = rule.everyMin % 60 === 0 ? `${rule.everyMin / 60} h` : `${rule.everyMin} min`;
  return `Every ${every} from ${clock(rule.fromMin)}`;
}
