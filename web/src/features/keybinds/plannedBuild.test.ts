import { beforeEach, describe, expect, it } from "vitest";
import fixture from "@/fixtures/compare.json";
import type { CompareResult } from "@/lib/types";
import { readActiveBuild, readPlannedBuild, storeActiveBuild, storePlannedBuild } from "./activeBuild";

const cmp = fixture as unknown as CompareResult;

beforeEach(() => localStorage.clear());
describe("selected plan handoff", () => {
  it("stores the exact allocated build and its leveling priority, without buying points again", () => {
    const fb = cmp.leveling!;
    storePlannedBuild(fb);
    const build = readActiveBuild()!;
    expect(build.skill_ranks).toEqual(fb.build.skill_ranks);
    expect(build.stigmas).toEqual(fb.build.stigmas);
    expect(build.skill_points).toBe(0);
    expect(build.stigma_points).toBe(0);
    expect(readPlannedBuild(build)).toMatchObject({ scenario: "level_pull", playstyle: "leveling", priority: fb.priority });
  });

  it("does not apply an old rotation to another build", () => {
    storePlannedBuild(cmp.boss!);
    const build = readActiveBuild()!;
    expect(readPlannedBuild({ ...build, level: build.level - 1 })).toBeNull();
    storeActiveBuild(build);
    expect(readPlannedBuild(build)).toBeNull();
  });

  it("rejects unsupported scenarios and corrupt saved plans", () => {
    expect(() => storePlannedBuild(cmp.burst!)).toThrow(/scenario/i);
    localStorage.setItem("aion2c.activeKeybindPlan.v1", "{broken");
    expect(readPlannedBuild(cmp.boss!.build)).toBeNull();
  });
});
