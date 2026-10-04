import { describe, expect, it } from "vitest";
import compare from "@/fixtures/compare.json";
import type { SimResult } from "@/lib/types";
import { damageBreakdown } from "./damageBreakdown";

function result(damage = [60, 30, 10], total = 100): SimResult {
  return {
    total_damage: total, dps: total, duration_s: 1, casts: [],
    per_skill: Object.fromEntries(damage.map((value, i) => [String.fromCharCode(97 + i), { casts: 1, damage: value }])),
    status_uptime: {}, warnings: [], confidence: "estimated",
  };
}

describe("damageBreakdown", () => {
  it("retains omitted damage and shares in Other without mutation", () => {
    const input = result();
    const before = structuredClone(input);
    expect(damageBreakdown(input, { a: "A", b: "B" }, 2)).toEqual([
      { key: "a", label: "A", damage: 60, share: 0.6 },
      { key: "b", label: "B", damage: 30, share: 0.3 },
      { key: "other", label: "Other", damage: 10, share: 0.1 },
    ]);
    expect(input).toEqual(before);
  });
  it("sorts descending with stable ties and readable unknown keys", () => {
    const input = result([30, 40, 30]);
    input.per_skill = { fire_bolt: { casts: 0, damage: 30 }, b: { casts: 0, damage: 40 }, "proc-hit": { casts: 0, damage: 30 } };
    expect(damageBreakdown(input, {})?.map(row => [row.key, row.label])).toEqual([
      ["b", "B"], ["fire_bolt", "Fire bolt"], ["proc-hit", "Proc hit"],
    ]);
  });
  it.each([NaN, Infinity, -1])("rejects invalid total or skill damage %s", value => {
    expect(damageBreakdown(result([100], value), {})).toBeNull();
    expect(damageBreakdown(result([value]), {})).toBeNull();
  });
  it("rejects mismatches and overflow but accepts the absolute and relative tolerance", () => {
    expect(damageBreakdown(result([], 100), {})).toBeNull();
    expect(damageBreakdown(result([60, 30, 10], 101), {})).toBeNull();
    expect(damageBreakdown(result([Number.MAX_VALUE, Number.MAX_VALUE], Number.MAX_VALUE), {})).toBeNull();
    expect(damageBreakdown(result([100], 100 + 0.0000005), {})).not.toBeNull();
    expect(damageBreakdown(result([1e12], 1e12 + 500), {})).not.toBeNull();
    expect(damageBreakdown(result([1e12], 1e12 + 2000), {})).toBeNull();
  });
  it("returns empty for reconciled zero and includes damage missing from casts", () => {
    expect(damageBreakdown(result([0, 0], 0), {})).toEqual([]);
    expect(damageBreakdown(result([100]), {})?.[0].damage).toBe(100);
    expect(damageBreakdown(result([0, 100]), {})?.map(row => row.damage)).toEqual([100]);
  });
  it("handles limit zero, oversized limits, invalid limits and Other key collisions", () => {
    expect(damageBreakdown(result(), {}, 0)).toEqual([{ key: "other", label: "Other", damage: 100, share: 1 }]);
    expect(damageBreakdown(result(), {}, 20)).toHaveLength(3);
    for (const limit of [-1, 1.5, NaN, Infinity]) expect(damageBreakdown(result(), {}, limit)).toBeNull();
    const input = result();
    input.per_skill = { other: { casts: 1, damage: 60 }, a: { casts: 1, damage: 40 } };
    const rows = damageBreakdown(input, {}, 1)!;
    expect(new Set(rows.map(row => row.key)).size).toBe(2);
    expect(rows.reduce((sum, row) => sum + row.damage, 0)).toBe(100);
  });
  it.each(["boss", "aoe", "leveling", "burst"] as const)("reconciles the complete %s fixture", key => {
    const input = compare[key].result as SimResult;
    const rows = damageBreakdown(input, {});
    expect(rows).not.toBeNull();
    expect(Math.abs(rows!.reduce((sum, row) => sum + row.damage, 0) - input.total_damage))
      .toBeLessThanOrEqual(Math.max(1e-6, 1e-9 * Math.abs(input.total_damage)));
  });
});
