import { describe, expect, it } from "vitest";
import {
  currentOccurrence,
  describeRule,
  formatCountdown,
  nextBoss,
  nextBossOccurrences,
  nextOccurrences,
  riftEntryOpen,
  zonedToUtc,
} from "./schedule";

const t = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16) + "Z";
// 2026-10-05 is a Monday
const MON = "2026-10-05";

describe("zonedToUtc (DST via Intl)", () => {
  it("applies the offset in force on that date", () => {
    expect(iso(zonedToUtc(2026, 3, 7, 12 * 60, "America/New_York"))).toBe("2026-03-07T17:00Z"); // EST
    expect(iso(zonedToUtc(2026, 3, 8, 12 * 60, "America/New_York"))).toBe("2026-03-08T16:00Z"); // EDT after spring forward
    expect(iso(zonedToUtc(2026, 10, 31, 12 * 60, "America/New_York"))).toBe("2026-10-31T16:00Z"); // EDT
    expect(iso(zonedToUtc(2026, 11, 1, 12 * 60, "America/New_York"))).toBe("2026-11-01T17:00Z"); // EST after fall back
  });
  it("handles fixed-offset regions", () => {
    expect(iso(zonedToUtc(2026, 10, 6, 5 * 60, "Asia/Seoul"))).toBe("2026-10-05T20:00Z");
    expect(iso(zonedToUtc(2026, 10, 6, 5 * 60, "Asia/Taipei"))).toBe("2026-10-05T21:00Z");
  });
});

describe("hourly and interval events", () => {
  it("Shugo is active for 10 minutes each hour", () => {
    const cur = currentOccurrence("shugo", "global", t(`${MON}T12:05:00Z`))!;
    expect(iso(cur.start)).toBe(`${MON}T12:00Z`);
    expect(iso(cur.end)).toBe(`${MON}T12:10Z`);
    expect(currentOccurrence("shugo", "global", t(`${MON}T12:10:00Z`))).toBeNull();
    expect(nextOccurrences("shugo", "global", t(`${MON}T12:10:00Z`), 2).map((o) => iso(o.start))).toEqual([`${MON}T13:00Z`, `${MON}T14:00Z`]);
  });

  it("returns an in-progress occurrence first, then upcoming ones in order", () => {
    const list = nextOccurrences("shugo", "global", t(`${MON}T12:05:00Z`), 5);
    expect(list).toHaveLength(5);
    expect(iso(list[0].start)).toBe(`${MON}T12:00Z`);
    for (let i = 1; i < 5; i++) expect(list[i].start).toBeGreaterThan(list[i - 1].start);
  });

  it("crosses local midnight without gaps or repeats", () => {
    const list = nextOccurrences("shugo", "kr", t(`${MON}T14:30:00Z`), 3); // 23:30 KST
    expect(list.map((o) => iso(o.start))).toEqual([`${MON}T15:00Z`, `${MON}T16:00Z`, `${MON}T17:00Z`]); // 00:00, 01:00, 02:00 KST
  });

  it("Kaira differs by schedule: every 180 min from 02:00 global, every 240 min from 01:00 KR/TW", () => {
    const g = nextOccurrences("kaira", "global", t(`${MON}T00:00:00Z`), 4).map((o) => iso(o.start));
    expect(g).toEqual([`${MON}T02:00Z`, `${MON}T05:00Z`, `${MON}T08:00Z`, `${MON}T11:00Z`]);
    // 01:00 KST Oct 6 = 16:00Z Oct 5; then 05:00 KST = 20:00Z
    const k = nextOccurrences("kaira", "kr", t(`${MON}T12:00:00Z`), 3).map((o) => iso(o.start));
    expect(k).toEqual([`${MON}T16:00Z`, `${MON}T20:00Z`, "2026-10-06T00:00Z"]);
    expect(nextOccurrences("kaira", "tw", t(`${MON}T12:00:00Z`), 2).map((o) => iso(o.start))).toEqual([`${MON}T13:00Z`, `${MON}T17:00Z`]); // 21:00 and 01:00 CST
  });
});

describe("Invasion", () => {
  it("starts at :30 every hour on both schedules, start only", () => {
    const g = nextOccurrences("invasion", "global", t(`${MON}T12:40:00Z`), 2);
    expect(g.map((o) => iso(o.start))).toEqual([`${MON}T13:30Z`, `${MON}T14:30Z`]);
    expect(g[0].end).toBe(g[0].start);
    expect(iso(nextOccurrences("invasion", "kr", t(`${MON}T12:40:00Z`), 1)[0].start)).toBe(`${MON}T13:30Z`);
  });
});

describe("Spacetime Rift entry window", () => {
  it("portal is open for the first 10 minutes of a 60 minute window (global, from 00:00 every 3 h)", () => {
    expect(riftEntryOpen("global", t(`${MON}T03:00:00Z`))).toBe(true);
    expect(riftEntryOpen("global", t(`${MON}T03:09:59Z`))).toBe(true);
    expect(riftEntryOpen("global", t(`${MON}T03:10:00Z`))).toBe(false);
    expect(currentOccurrence("rift", "global", t(`${MON}T03:59:00Z`))).not.toBeNull(); // rift still running
    expect(currentOccurrence("rift", "global", t(`${MON}T04:00:00Z`))).toBeNull();
    expect(riftEntryOpen("global", t(`${MON}T04:05:00Z`))).toBe(false);
    expect(iso(nextOccurrences("rift", "global", t(`${MON}T04:00:00Z`), 1)[0].start)).toBe(`${MON}T06:00Z`);
  });

  it("KR rift starts at 02:00 KST (17:00Z)", () => {
    expect(riftEntryOpen("kr", t(`${MON}T17:05:00Z`))).toBe(true);
    expect(riftEntryOpen("kr", t(`${MON}T15:05:00Z`))).toBe(false); // 00:05 KST is not a rift start (starts 02, 05, ... 23)
    expect(riftEntryOpen("global", t(`${MON}T17:05:00Z`))).toBe(false); // global rifts start at 15:00, 18:00
  });
});

describe("day and week rules", () => {
  it("daily reset is 16:00 global and 05:00 local in KR/TW", () => {
    expect(iso(nextOccurrences("daily", "global", t(`${MON}T10:00:00Z`), 1)[0].start)).toBe(`${MON}T16:00Z`);
    expect(iso(nextOccurrences("daily", "kr", t(`${MON}T10:00:00Z`), 1)[0].start)).toBe(`${MON}T20:00Z`);
    expect(iso(nextOccurrences("daily", "tw", t(`${MON}T10:00:00Z`), 1)[0].start)).toBe(`${MON}T21:00Z`);
  });

  it("a reset that just happened is not 'next'", () => {
    expect(iso(nextOccurrences("daily", "global", t(`${MON}T16:00:00Z`), 1)[0].start)).toBe("2026-10-06T16:00Z");
    expect(currentOccurrence("daily", "global", t(`${MON}T16:00:00Z`))).toBeNull();
  });

  it("weekly reset is Wednesday only", () => {
    expect(iso(nextOccurrences("weekly", "global", t(`${MON}T00:00:00Z`), 2)[0].start)).toBe("2026-10-07T16:00Z");
    expect(iso(nextOccurrences("weekly", "global", t(`${MON}T00:00:00Z`), 2)[1].start)).toBe("2026-10-14T16:00Z");
    expect(iso(nextOccurrences("weekly", "kr", t(`${MON}T00:00:00Z`), 1)[0].start)).toBe("2026-10-06T20:00Z"); // Wed 05:00 KST
  });

  it("Artifact Siege and Siege Bosses run Mon/Thu/Sat on global", () => {
    const art = nextOccurrences("artifact", "global", t(`${MON}T20:00:00Z`), 3).map((o) => iso(o.start));
    expect(art).toEqual([`${MON}T21:00Z`, "2026-10-08T21:00Z", "2026-10-10T21:00Z"]);
    const sb = nextOccurrences("siegeBosses", "global", t(`${MON}T21:45:00Z`), 2); // mid-siege
    expect(iso(sb[0].start)).toBe(`${MON}T21:30Z`);
    expect(iso(sb[0].end)).toBe(`${MON}T22:00Z`);
    expect(iso(sb[1].start)).toBe("2026-10-08T21:30Z");
  });

  it("KR/TW siege is Wed/Sat at 21:20 and 21:45 local", () => {
    // Wed 2026-10-07 21:20 KST = 12:20Z
    expect(nextOccurrences("artifact", "kr", t(`${MON}T00:00:00Z`), 2).map((o) => iso(o.start))).toEqual(["2026-10-07T12:20Z", "2026-10-10T12:20Z"]);
    expect(iso(nextOccurrences("siegeBosses", "tw", t(`${MON}T00:00:00Z`), 1)[0].start)).toBe("2026-10-07T13:45Z"); // 21:45 CST
  });

  it("Nahma is Sun/Fri: 19:00 global, 22:00 KR", () => {
    expect(nextOccurrences("nahma", "global", t(`${MON}T00:00:00Z`), 2).map((o) => iso(o.start))).toEqual(["2026-10-09T19:00Z", "2026-10-11T19:00Z"]);
    expect(iso(nextOccurrences("nahma", "kr", t(`${MON}T00:00:00Z`), 1)[0].start)).toBe("2026-10-09T13:00Z");
  });

  it("local weekday decides the day, not the UTC weekday", () => {
    // 05:30 Wed in TW is still Tuesday in UTC; the weekday must come from the local date
    const wk = nextOccurrences("weekly", "tw", t("2026-10-06T21:30:00Z"), 1)[0];
    expect(iso(wk.start)).toBe("2026-10-13T21:00Z"); // next Wed 05:00 CST = Tue 21:00Z
  });
});

describe("next boss", () => {
  it("picks the soonest of Kaira, siege bosses and Nahma", () => {
    const b = nextBoss("global", t(`${MON}T12:00:00Z`));
    expect(b.active).toBe(false);
    expect(b.occurrence.event).toBe("kaira");
    expect(iso(b.occurrence.start)).toBe(`${MON}T14:00Z`);
  });

  it("reports the running boss event as active", () => {
    const b = nextBoss("global", t(`${MON}T21:40:00Z`));
    expect(b.active).toBe(true);
    expect(b.occurrence.event).toBe("siegeBosses");
  });

  it("lists mixed boss events in time order", () => {
    const list = nextBossOccurrences("global", t(`${MON}T20:30:00Z`), 5);
    expect(list).toHaveLength(5);
    expect(list[0].event).toBe("siegeBosses"); // 21:30 beats the 23:00 Kaira spawn
    for (let i = 1; i < list.length; i++) expect(list[i].start).toBeGreaterThanOrEqual(list[i - 1].start);
  });
});

describe("formatting", () => {
  it("formats countdowns as d h / h mm / m ss / s", () => {
    expect(formatCountdown(2 * 86400_000 + 3 * 3600_000 + 59_000)).toBe("2d 3h");
    expect(formatCountdown(3 * 3600_000 + 5 * 60_000 + 7_000)).toBe("3h 05m");
    expect(formatCountdown(4 * 60_000 + 12_000)).toBe("4m 12s");
    expect(formatCountdown(9_000)).toBe("9s");
    expect(formatCountdown(0)).toBe("0s");
    expect(formatCountdown(-5000)).toBe("0s");
  });

  it("describes rules in the region's own clock", () => {
    expect(describeRule("rift", "global")).toBe("Every 3 h from 00:00");
    expect(describeRule("rift", "kr")).toBe("Every 3 h from 02:00");
    expect(describeRule("siegeBosses", "global")).toBe("Mon, Thu, Sat at 21:30");
  });
});
