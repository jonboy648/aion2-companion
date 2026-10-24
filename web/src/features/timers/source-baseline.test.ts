import { describe, expect, it } from "vitest";
import baseline from "../../../../docs/data/source-baseline.json";
import { REGIONS, TIMINGS } from "./data";
import { nextOccurrences } from "./schedule";

describe("reviewed schedule source boundary", () => {
  it("connects the Global invasion witness to the browser schedule in minutes", () => {
    const source = baseline.schedule;
    expect(source.event).toBe("invasion");
    expect(source.region).toBe("global");
    expect(REGIONS.global.tz).toBe(source.time_zone);
    expect(TIMINGS[REGIONS.global.schedule].invasion.rule).toEqual({
      kind: "interval", everyMin: source.every_minutes, fromMin: source.offset_minutes,
    });
    const starts = nextOccurrences("invasion", "global", Date.parse("2026-10-05T12:40:00Z"), 2);
    expect(starts.map((entry) => entry.start)).toEqual([
      Date.parse("2026-10-05T13:30:00Z"), Date.parse("2026-10-05T14:30:00Z"),
    ]);
  });

  it("does not promote unknown duration or regional extrapolation to client facts", () => {
    expect(baseline.schedule.duration_minutes).toBeNull();
    expect(baseline.schedule.in_game_verified).toBe(false);
    expect(baseline.schedule.korea_taiwan_verified).toBe(false);
    expect(baseline.source.export_client_build).toBeNull();
    expect(baseline.source.installed_client_observation.identifies_export).toBe(false);
  });
});
