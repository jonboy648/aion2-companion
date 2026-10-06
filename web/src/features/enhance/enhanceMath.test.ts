import { describe, expect, it } from "vitest";
import {
  attemptsCdf,
  attemptsPercentile,
  chanceWithin,
  costPercentiles,
  plan,
  successAt,
  type Step,
} from "./enhanceMath";

const step = (p: number, kinah = 0, extra: Partial<Step> = {}): Step => ({ p, fc: 0, drop: 0, kinah, mats: {}, ...extra });

describe("single step, no pity (geometric)", () => {
  const s = [step(0.5, 100, { mats: { Stone: 4 } })];
  it("expects 1/p attempts and prices every attempt", () => {
    const r = plan(s, 0, 1);
    expect(r.attempts).toBeCloseTo(2, 10);
    expect(r.kinah).toBeCloseTo(200, 8);
    expect(r.mats.Stone).toBeCloseTo(8, 8);
  });
  it("has the cdf 1 - 0.5^n", () => {
    const c = attemptsCdf(s, 0, 1);
    expect(c.truncated).toBe(false);
    expect(chanceWithin(c, 1)).toBeCloseTo(0.5, 12);
    expect(chanceWithin(c, 2)).toBeCloseTo(0.75, 12);
    expect(chanceWithin(c, 4)).toBeCloseTo(0.9375, 12);
    expect(attemptsPercentile(c, 0.5)).toBe(1);
    expect(attemptsPercentile(c, 0.9)).toBe(4); // 1 - 0.5^3 = 0.875 < 0.9 <= 0.9375
  });
  it("a certain step costs exactly one attempt and finishes in one", () => {
    const r = plan([step(1, 7)], 0, 1);
    expect([r.attempts, r.kinah]).toEqual([1, 7]);
    expect(chanceWithin(attemptsCdf([step(1)], 0, 1), 1)).toBe(1);
  });
});

describe("pity", () => {
  // p = 0.5, +0.25 per consecutive failure: 0.5, 0.75, 1.0
  const s = [step(0.5, 10, { fc: 0.25 })];
  it("caps the chance at 100% and ends the streak", () => {
    expect(successAt(s[0], 0)).toBe(0.5);
    expect(successAt(s[0], 1)).toBe(0.75);
    expect(successAt(s[0], 2)).toBe(1);
    expect(successAt(s[0], 9)).toBe(1);
    expect(successAt(s[0], 9, false)).toBe(0.5);
  });
  it("expects 1 + 0.5 + 0.5*0.25 = 1.625 attempts and has pmf .5/.375/.125", () => {
    const r = plan(s, 0, 1);
    expect(r.attempts).toBeCloseTo(1.625, 10);
    expect(r.kinah).toBeCloseTo(16.25, 8);
    const c = attemptsCdf(s, 0, 1);
    expect([1, 2, 3].map((n) => chanceWithin(c, n))).toEqual([0.5, 0.875, 1].map((x) => expect.closeTo(x, 12)));
    expect(c.cdf.length).toBe(4); // finished for certain after 3
  });
  it("is cheaper than the same odds without pity", () => {
    expect(plan(s, 0, 1, { pity: false }).attempts).toBeCloseTo(2, 10);
  });
});

describe("a chain of steps", () => {
  const s = [step(0.5, 10), step(0.25, 100), step(1, 1000)];
  it("sums the per-level expectations", () => {
    const r = plan(s, 0, 3);
    expect(r.perLevel.map((x) => x.attempts)).toEqual([expect.closeTo(2, 10), expect.closeTo(4, 10), expect.closeTo(1, 10)]);
    expect(r.kinah).toBeCloseTo(2 * 10 + 4 * 100 + 1000, 8);
  });
  it("starts from a middle level and stops at the target", () => {
    const r = plan(s, 1, 2);
    expect(r.attempts).toBeCloseTo(4, 10);
    expect(r.kinah).toBeCloseTo(400, 8);
    expect(plan(s, 2, 2).attempts).toBe(0);
  });
  it("two fair coins: attempts are 2 + NegBin, cdf(2) = 1/4, cdf(3) = 1/2", () => {
    const two = [step(0.5), step(0.5)];
    const c = attemptsCdf(two, 0, 2);
    expect(chanceWithin(c, 1)).toBe(0);
    expect(chanceWithin(c, 2)).toBeCloseTo(0.25, 12);
    expect(chanceWithin(c, 3)).toBeCloseTo(0.5, 12);
    expect(attemptsPercentile(c, 0.5)).toBe(3);
  });
  it("rejects levels outside the table", () => {
    expect(() => plan(s, 0, 4)).toThrow(RangeError);
  });
  it("is infeasible when a step can never succeed", () => {
    expect(plan([step(0)], 0, 1).feasible).toBe(false);
    expect(attemptsCdf([step(0)], 0, 1).truncated).toBe(true);
  });
});

describe("failure drops a level (the rune)", () => {
  // level 0: certain, 4 kinah. level 1: 50%, loses a level on failure, 10 kinah. from 1 to 2.
  const s = [step(1, 4), step(0.5, 10, { drop: 1 })];
  it("matches the recurrence E1 = (1 + (1-p) E0) / p = 3 attempts, C1 = (c + (1-p) C0) / p = 24 kinah", () => {
    const r = plan(s, 1, 2);
    expect(r.attempts).toBeCloseTo(3, 10);
    expect(r.kinah).toBeCloseTo(24, 8);
    expect(r.perLevel.map((x) => [x.level, x.attempts])).toEqual([
      [0, expect.closeTo(1, 10)],
      [1, expect.closeTo(2, 10)],
    ]);
  });
  it("matches the closed recurrence on a longer ladder", () => {
    const ps = [0.8, 0.66, 0.5, 0.33];
    const ladder = ps.map((p, i) => step(p, 10 * (i + 1), { drop: i === 0 ? 0 : 1 }));
    // step cost of L -> L+1: E_L = (1 + (1 - p_L) E_{L-1}) / p_L (a failure drops to L-1 and must climb back), same for kinah;
    // the range total is the sum over its steps
    let e = 0;
    let c = 0;
    let eSum = 0;
    let cSum = 0;
    ps.forEach((p, i) => {
      e = (1 + (1 - p) * e) / p;
      c = (10 * (i + 1) + (1 - p) * c) / p;
      eSum += e;
      cSum += c;
    });
    const r = plan(ladder, 0, 4);
    expect(r.attempts).toBeCloseTo(eSum, 8);
    expect(r.kinah).toBeCloseTo(cSum, 6);
  });
  it("the cdf agrees with a simulation of the same chain", () => {
    const c = attemptsCdf(s, 1, 2);
    expect(chanceWithin(c, 1)).toBeCloseTo(0.5, 12);
    expect(chanceWithin(c, 2)).toBeCloseTo(0.5, 12); // second attempt is the level-0 repair, cannot finish
    expect(chanceWithin(c, 3)).toBeCloseTo(0.75, 12);
    const spread = costPercentiles(s, 1, 2, (x) => x.kinah);
    expect(spread.method).toBe("simulated");
    expect(spread.median).toBe(10); // 50% finish on the first 10-kinah attempt
    expect(spread.p90).toBeGreaterThan(24);
  });
});

describe("cost percentiles (no drops: exact)", () => {
  it("one fair coin at 10 kinah per try: median 10, p90 40", () => {
    const r = costPercentiles([step(0.5, 10)], 0, 1, (s) => s.kinah);
    expect(r.method).toBe("exact");
    expect(r.median).toBeCloseTo(10, 6);
    expect(r.p90).toBeCloseTo(40, 6);
  });
  it("agrees with the attempts distribution when every attempt costs 1", () => {
    const ladder = [step(0.5), step(0.3, 0, { fc: 0.1 }), step(0.2)];
    const c = attemptsCdf(ladder, 0, 3);
    const r = costPercentiles(ladder, 0, 3, () => 1);
    expect(r.median).toBeCloseTo(attemptsPercentile(c, 0.5)!, 1);
    expect(r.p90).toBeCloseTo(attemptsPercentile(c, 0.9)!, 1);
  });
  it("prices levels differently (the p90 of kinah is not the kinah of the p90 attempt)", () => {
    const ladder = [step(0.5, 1), step(0.5, 1000)];
    const r = costPercentiles(ladder, 0, 2, (s) => s.kinah);
    // the expensive level dominates: one try (1000) w.p. .5, so its median is 1 try there + at least 1 cheap try
    expect(r.median).toBeGreaterThanOrEqual(1001);
    expect(r.p90).toBeGreaterThan(r.median!);
  });
});
